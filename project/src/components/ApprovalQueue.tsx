import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ToolCall } from '../lib/types';
import { getTool, validateToolArgs } from '../lib/tools';
import { CheckCircle, XCircle, AlertTriangle, FileText, Clock, Loader2 } from 'lucide-react';
import { PasswordConfirmModal } from './PasswordConfirmModal';

interface ApprovalQueueProps {
  sessionId: string | null;
  onUpdate?: () => void;
}

export function ApprovalQueue({ sessionId, onUpdate }: ApprovalQueueProps) {
  const { user } = useAuth();
  const [pending, setPending] = useState<ToolCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingPasswordApproval, setPendingPasswordApproval] = useState<ToolCall | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPending();

    // Subscribe to new tool calls
    const channel = supabase
      .channel('tool_calls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tool_calls',
        filter: `user_id=eq.${user.id}`,
      }, loadPending)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, sessionId]);

  async function loadPending() {
    if (!user) return;
    const query = supabase
      .from('tool_calls')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (sessionId) query.eq('session_id', sessionId);

    const { data } = await query;
    setPending((data as ToolCall[]) || []);
  }

  async function approve(toolCall: ToolCall) {
    // If password required, show modal instead of executing immediately
    if (toolCall.escalation_level === 'password') {
      setPendingPasswordApproval(toolCall);
      setPasswordModalOpen(true);
      return;
    }

    await executeToolCall(toolCall);
  }

  async function executeToolCall(toolCall: ToolCall) {
    setLoading(true);
    try {
      // Update status to approved
      await supabase
        .from('tool_calls')
        .update({ status: 'approved' })
        .eq('id', toolCall.id);

      // Execute the tool
      const tool = getTool(toolCall.tool);
      if (!tool) throw new Error(`Unknown tool: ${toolCall.tool}`);

      const validation = validateToolArgs(tool, toolCall.args);
      if (!validation.valid) throw new Error(validation.error);

      const result = await tool.execute(toolCall.args);

      // Update with result
      await supabase
        .from('tool_calls')
        .update({
          status: result.success ? 'executed' : 'failed',
          result: result,
          executed_at: new Date().toISOString(),
        })
        .eq('id', toolCall.id);

      // Log to audit trail
      await supabase.from('audit_log').insert({
        user_id: user!.id,
        tool_call_id: toolCall.id,
        action: toolCall.tool,
        details: { args: toolCall.args, result },
        approved_by: user!.id,
      });

      await loadPending();
      onUpdate?.();
    } catch (error: any) {
      console.error('Tool execution error:', error);
      await supabase
        .from('tool_calls')
        .update({
          status: 'failed',
          result: { success: false, error: error.message },
          executed_at: new Date().toISOString(),
        })
        .eq('id', toolCall.id);
    } finally {
      setLoading(false);
    }
  }

  async function reject(toolCall: ToolCall) {
    await supabase
      .from('tool_calls')
      .update({ status: 'rejected', executed_at: new Date().toISOString() })
      .eq('id', toolCall.id);

    await supabase.from('audit_log').insert({
      user_id: user!.id,
      tool_call_id: toolCall.id,
      action: `${toolCall.tool}.rejected`,
      details: { args: toolCall.args },
      approved_by: user!.id,
    });

    await loadPending();
    onUpdate?.();
  }

  function handlePasswordConfirmed() {
    if (pendingPasswordApproval) {
      executeToolCall(pendingPasswordApproval);
      setPendingPasswordApproval(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="border-t border-slate-800/50 bg-slate-950/40 backdrop-blur-sm">
      <div className="px-4 py-3 border-b border-slate-800/50">
        <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Pending Approval ({pending.length})
        </h3>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {pending.map((call) => {
          const tool = getTool(call.tool);
          const isPasswordRequired = call.escalation_level === 'password';

          return (
            <div key={call.id} className="p-4 border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{call.tool}</span>
                    {isPasswordRequired && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-300 rounded border border-red-500/30">
                        HIGH RISK
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    {Object.entries(call.args).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-slate-500">{key}:</span>
                        <span className="text-slate-300 truncate">{JSON.stringify(value)}</span>
                      </div>
                    ))}
                  </div>

                  {tool && (
                    <p className="text-xs text-slate-500 mt-1">{tool.description}</p>
                  )}

                  <div className="flex items-center gap-1 text-xs text-slate-600 mt-2">
                    <Clock className="w-3 h-3" />
                    {new Date(call.created_at).toLocaleTimeString()}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve(call)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/30 text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    Approve
                  </button>

                  <button
                    onClick={() => reject(call)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <PasswordConfirmModal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setPendingPasswordApproval(null);
        }}
        onConfirm={handlePasswordConfirmed}
        toolName={pendingPasswordApproval?.tool || ''}
      />
    </div>
  );
}
