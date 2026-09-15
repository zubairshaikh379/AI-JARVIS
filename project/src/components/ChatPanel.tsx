import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../lib/types';
import { useSpeechSynthesis } from '../hooks/useSpeech';
import { Send, Loader2, Volume2, VolumeX, Trash2 } from 'lucide-react';

interface ChatPanelProps {
  sessionId: string;
  messages: Message[];
  onMessagesChange: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

export function ChatPanel({ sessionId, messages, onMessagesChange, voiceEnabled, onToggleVoice }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { speak, speaking } = useSpeechSynthesis();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setInput('');
    setError(null);
    setSending(true);

    const { error: insertError } = await supabase
      .from('messages')
      .insert({ session_id: sessionId, role: 'user', content: trimmed });

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    onMessagesChange();

    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20);

    const apiMessages = (history || []).map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.reply) throw new Error('LLM returned empty response');

      const { error: assistantInsertError } = await supabase
        .from('messages')
        .insert({ session_id: sessionId, role: 'assistant', content: data.reply });

      if (assistantInsertError) throw new Error(assistantInsertError.message);

      onMessagesChange();

      if (voiceEnabled) speak(data.reply);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
    } finally {
      setSending(false);
    }
  }

  async function clearMessages() {
    const { error: delError } = await supabase
      .from('messages')
      .delete()
      .eq('session_id', sessionId);
    if (!delError) onMessagesChange();
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Conversation</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleVoice}
            className={`p-1.5 rounded-md transition-all ${
              voiceEnabled ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={voiceEnabled ? 'Voice responses on' : 'Voice responses off'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 transition-all"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-8">
            Start speaking or typing. JARVIS is listening.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-50'
                  : 'bg-slate-800/60 border border-slate-700/50 text-slate-200'
              } ${speaking && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id ? 'ring-1 ring-emerald-500/30' : ''}`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            </div>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-sm text-red-300">
            {error}
            {error.includes('GROQ_API_KEY') && (
              <span className="block mt-1 text-xs text-red-300/70">
                Add it in Supabase Dashboard → Edge Functions → Secrets.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-700/50">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or speak your message..."
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white p-2.5 rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
