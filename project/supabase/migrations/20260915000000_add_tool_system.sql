/*
# Add Tool Call System and Audit Log

## What this does
Adds approval queue and audit trail for sandboxed command execution.
This enables JARVIS to request file operations, reminders, and other actions
that require user approval before execution.

## New Tables
1. tool_calls
   - Stores structured tool requests from the LLM
   - Status workflow: pending -> approved/rejected -> executed/failed
   - Escalation levels: auto (logged only), confirm (tap to approve), password (re-auth required)

2. audit_log
   - Immutable record of every action taken
   - Links to tool_calls and user who approved
   - Full args + result for forensics

## Security
- RLS enabled on both tables
- Owner-scoped: users only see their own tool calls and audit entries
- audit_log is append-only (no UPDATE or DELETE policies)
*/

-- ── tool_calls ──
CREATE TABLE IF NOT EXISTS tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed')),
  result jsonb,
  escalation_level text NOT NULL DEFAULT 'auto' CHECK (escalation_level IN ('auto','confirm','password')),
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_user_id ON tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_status ON tool_calls(status);
CREATE INDEX IF NOT EXISTS idx_tool_calls_session_id ON tool_calls(session_id);

ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tool_calls" ON tool_calls;
CREATE POLICY "select_own_tool_calls" ON tool_calls FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tool_calls" ON tool_calls;
CREATE POLICY "insert_own_tool_calls" ON tool_calls FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tool_calls" ON tool_calls;
CREATE POLICY "update_own_tool_calls" ON tool_calls FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tool_calls" ON tool_calls;
CREATE POLICY "delete_own_tool_calls" ON tool_calls FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── audit_log ──
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_call_id uuid REFERENCES tool_calls(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_tool_call_id ON audit_log(tool_call_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit" ON audit_log;
CREATE POLICY "select_own_audit" ON audit_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit" ON audit_log;
CREATE POLICY "insert_own_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Audit log is append-only: no UPDATE or DELETE policies
