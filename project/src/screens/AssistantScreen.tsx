import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSpeechRecognition, useSpeechSynthesis } from '../hooks/useSpeech';
import { Orb } from '../components/Orb';
import { ChatPanel } from '../components/ChatPanel';
import { ApprovalQueue } from '../components/ApprovalQueue';
import { FileAccessButton } from '../components/FileAccessButton';
import { VoiceSettings } from '../components/VoiceSettings';
import { MacroManager } from '../components/MacroManager';
import { Mic, MicOff, LogOut, Plus, MessageSquare, Loader2, Zap, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { ChatSession, Message } from '../lib/types';
import { useEffect, useCallback, useRef } from 'react';

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function AssistantScreen() {
  const { user, profile, signOut } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showMacros, setShowMacros] = useState(false);
  const interimRef = useRef('');

  const { speak, cancel } = useSpeechSynthesis();

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (data) setSessions(data as ChatSession[]);
    setLoadingSessions(false);
  }, [user]);

  const loadMessages = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession.id);
  }, [activeSession, loadMessages]);

  async function newSession() {
    if (!user) return;
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title: 'New Conversation' })
      .select('*')
      .maybeSingle();
    if (error) return;
    if (data) {
      const newSess = data as ChatSession;
      setSessions((prev) => [newSess, ...prev]);
      setActiveSession(newSess);
      setMessages([]);
    }
  }

  async function deleteSession(id: string) {
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
    if (error) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession?.id === id) {
      setActiveSession(null);
      setMessages([]);
    }
  }

  const { isListening, start, stop, error: speechError } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (isFinal) {
        interimRef.current = '';
        sendVoiceMessage(text);
      } else {
        interimRef.current = text;
      }
    },
  });

  async function sendVoiceMessage(text: string) {
    if (!activeSession || !text.trim()) return;
    setOrbState('thinking');

    await supabase.from('messages').insert({
      session_id: activeSession.id,
      role: 'user',
      content: text.trim(),
    });
    loadMessages(activeSession.id);

    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', activeSession.id)
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
        body: JSON.stringify({ messages: apiMessages, sessionId: activeSession.id }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.reply) throw new Error('LLM returned empty response');

      await supabase.from('messages').insert({
        session_id: activeSession.id,
        role: 'assistant',
        content: data.reply,
      });
      loadMessages(activeSession.id);

      if (voiceEnabled) {
        setOrbState('speaking');
        speak(data.reply);
        const checkSpeaking = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(checkSpeaking);
            setOrbState('idle');
          }
        }, 200);
      } else {
        setOrbState('idle');
      }
    } catch (err: any) {
      setOrbState('idle');
      console.error('Voice message error:', err.message);
    }
  }

  function toggleListening() {
    if (isListening) {
      stop();
      setOrbState('idle');
    } else {
      if (!activeSession) return;
      cancel();
      interimRef.current = '';
      start();
      setOrbState('listening');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950/60 border-r border-slate-800/50 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2 border-b border-slate-800/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg tracking-tight">JARVIS</span>
        </div>

        <div className="p-3">
          <button
            onClick={newSession}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg py-2.5 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {loadingSessions && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            </div>
          )}
          {sessions.map((sess) => (
            <div
              key={sess.id}
              onClick={() => setActiveSession(sess)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                activeSession?.id === sess.id
                  ? 'bg-slate-800/70 text-white'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="text-sm truncate flex-1">{sess.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(sess.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
              >
                ×
              </button>
            </div>
          ))}
          {!loadingSessions && sessions.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">No conversations yet</p>
          )}
        </div>

        <div className="p-3 border-t border-slate-800/50 space-y-3">
          <button
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            className="w-full flex items-center justify-center gap-2 bg-slate-800/40 hover:bg-slate-800/60 text-slate-300 border border-slate-700/50 rounded-lg py-2 text-sm font-medium transition-all"
          >
            <Settings className="w-4 h-4" />
            Voice Settings
          </button>

          {showVoiceSettings && (
            <div className="bg-slate-900/80 border border-slate-700 rounded-lg">
              <VoiceSettings />
            </div>
          )}

          <button
            onClick={() => setShowMacros(!showMacros)}
            className="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg py-2 text-sm font-medium transition-all"
          >
            <Zap className="w-4 h-4" />
            Voice Macros
          </button>

          {showMacros && (
            <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4">
              <MacroManager />
            </div>
          )}

          <FileAccessButton />

          <div className="flex items-center gap-2 px-2 pt-2 border-t border-slate-800/30">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold">
              {(profile?.display_name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.display_name || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-400 text-sm py-2 rounded-lg hover:bg-slate-800/40 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated gradient orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-400/3 rounded-full blur-3xl" />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        {/* Orb section */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden z-10">
          {/* Ambient glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
            <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-blue-500/5 blur-[100px]" />
          </div>

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }}
          />

          {!activeSession ? (
            <div className="relative z-10 text-center">
              <Orb state="idle" size={300} />
              <h2 className="text-2xl font-bold text-white mt-8">Welcome to JARVIS</h2>
              <p className="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
                Create a new chat to start talking with your AI assistant. Use voice or text.
              </p>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center">
              <Orb state={orbState} size={280} />

              {/* Live transcript */}
              {isListening && (
                <div className="mt-6 min-h-[2rem] max-w-md text-center">
                  <p className={`text-sm ${interimRef.current ? 'text-cyan-300' : 'text-slate-500'}`}>
                    {interimRef.current || 'Listening...'}
                  </p>
                </div>
              )}

              {/* Status label */}
              {!isListening && (
                <p className="mt-6 text-sm font-medium uppercase tracking-widest text-slate-500">
                  {orbState === 'thinking' ? 'Processing...' :
                   orbState === 'speaking' ? 'Speaking...' :
                   'Ready'}
                </p>
              )}

              {/* Mic button */}
              <button
                onClick={toggleListening}
                disabled={!activeSession}
                className={`mt-8 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  isListening
                    ? 'bg-red-500/20 border-2 border-red-500/50 shadow-red-500/20 animate-pulse'
                    : 'bg-cyan-500/20 border-2 border-cyan-500/50 hover:bg-cyan-500/30 shadow-cyan-500/20'
                } disabled:opacity-30`}
              >
                {isListening ? <MicOff className="w-6 h-6 text-red-400" /> : <Mic className="w-6 h-6 text-cyan-300" />}
              </button>

              {speechError && (
                <p className="mt-4 text-xs text-amber-400/70 max-w-xs text-center">{speechError}</p>
              )}
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className="w-[400px] border-l border-slate-800/50 flex flex-col">
          {activeSession ? (
            <>
              <ChatPanel
                sessionId={activeSession.id}
                messages={messages}
                onMessagesChange={() => loadMessages(activeSession.id)}
                voiceEnabled={voiceEnabled}
                onToggleVoice={() => { setVoiceEnabled(!voiceEnabled); if (voiceEnabled) cancel(); }}
              />
              <ApprovalQueue
                sessionId={activeSession.id}
                onUpdate={() => loadMessages(activeSession.id)}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              Select or create a chat
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
