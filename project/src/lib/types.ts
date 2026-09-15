// Database types matching Supabase schema

export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export type ToolCallStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type EscalationLevel = 'auto' | 'confirm' | 'password';

export interface ToolCall {
  id: string;
  session_id: string | null;
  user_id: string;
  tool: string;
  args: Record<string, any>;
  status: ToolCallStatus;
  result: Record<string, any> | null;
  escalation_level: EscalationLevel;
  created_at: string;
  executed_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  tool_call_id: string | null;
  action: string;
  details: Record<string, any>;
  approved_by: string | null;
  created_at: string;
}

// Tool call request from LLM
export interface ToolCallRequest {
  tool: string;
  args: Record<string, any>;
  reasoning?: string; // optional explanation from LLM
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}
