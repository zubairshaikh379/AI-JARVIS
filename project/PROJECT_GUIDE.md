# JARVIS — AI Assistant with Sandboxed System Control

## Project Architecture & Continuity Guide

This document contains the full technical architecture, security model, and implementation roadmap. It ensures anyone picking up this project can continue building without losing context.

---

## 1. THE AIM

Build a **voice-controlled AI assistant** that can operate the user's computer through a **sandboxed, approval-gated execution environment**. Think "Jarvis" — you talk to it, it understands, it can read/write files and run commands on your machine, but only inside a locked-down sandbox with an escalation ladder for dangerous operations.

### Core principles
- **Voice-first interface** — speak commands, hear responses.
- **Sandboxed execution** — the AI never emits raw shell commands. It returns structured tool calls that are validated, jailed, and approval-gated.
- **Airtight security** — allowlist-based tools, path jailing, escalation ladder, full audit log. Prompt injection cannot escalate beyond what the user has approved.
- **Zero budget** — built entirely on free-tier services (Supabase, Groq, Vercel).
- **Open source** — MIT licensed, fully transparent, community-driven.

---

## 2. ARCHITECTURE — THREE SLICES

The project is built in three shippable slices. Each is independently valuable.

### Slice 1: Hosted Core (CURRENT FOCUS)
- **3D React UI** with a futuristic aesthetic (orb visualizer, voice waveform, chat).
- **Voice input** via Web Speech API (SpeechRecognition) + voice output (SpeechSynthesis).
- **Supabase auth** (email/password sign-up + sign-in).
- **Chat with LLM** through a Supabase Edge Function (LLM API key stays server-side, never exposed to browser).
- **No system access yet** — just conversation. Fully deployable and shareable.

### Slice 2: Approval + Audit Layer
- **Structured tool-call protocol** — LLM returns JSON tool calls, not free text.
- **Command queue in Supabase** — pending commands stored as rows, each with a status (pending/approved/rejected/executed/failed).
- **Escalation ladder:**
  - `read`, `search`, `list` → auto-approve (logged only)
  - `write`, `create`, `move` → tap-to-approve in UI
  - `delete`, `install-package`, `network-fetch` → require password re-entry
- **Approval UI** — pending commands surface in the interface with approve/reject buttons.
- **Audit log** — every tool call recorded: who, what, args, approved by, result, timestamp.

### Slice 3: Local Executor Daemon
- **Runs on the user's machine** (Node.js daemon, not hosted).
- **Polls Supabase** for approved commands, executes them inside the jail, writes results back.
- **Path jailing** — all paths resolved and checked against a designated workspace root. `../../etc/passwd` → rejected.
- **Allowlisted commands only** — no "run arbitrary command" tool. If shell access is needed later, it's an opt-in, allowlisted-command-only tool.
- **WebSocket or Supabase Realtime** for live status updates back to the UI.

---

## 3. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS |
| Icons | lucide-react |
| 3D/Animation | CSS 3D transforms + Framer Motion (if added) |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| LLM | Groq (Llama 3.3 70B) or Gemini — via Edge Function |
| Voice | Web Speech API (browser-native, no deps) |
| Local Executor | Node.js daemon (slice 3) |

---

## 4. DATABASE SCHEMA

### Tables

#### `profiles`
Extends Supabase `auth.users` with display name.
- `id` uuid PK, references `auth.users(id)` ON DELETE CASCADE
- `display_name` text
- `created_at` timestamptz DEFAULT now()

#### `chat_sessions`
Each conversation is a session.
- `id` uuid PK DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL DEFAULT auth.uid(), references auth.users
- `title` text (auto-generated from first message)
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

#### `messages`
Individual messages within a session.
- `id` uuid PK DEFAULT gen_random_uuid()
- `session_id` uuid NOT NULL, references chat_sessions ON DELETE CASCADE
- `user_id` uuid NOT NULL DEFAULT auth.uid(), references auth.users
- `role` text NOT NULL CHECK (role IN ('user', 'assistant', 'system'))
- `content` text NOT NULL
- `created_at` timestamptz DEFAULT now()

#### `tool_calls` (Slice 2+)
Structured tool calls from the LLM, awaiting approval or executed.
- `id` uuid PK DEFAULT gen_random_uuid()
- `session_id` uuid, references chat_sessions ON DELETE CASCADE
- `user_id` uuid NOT NULL DEFAULT auth.uid(), references auth.users
- `tool` text NOT NULL (e.g. 'file.read', 'file.write', 'shell.exec')
- `args` jsonb NOT NULL DEFAULT '{}'
- `status` text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed'))
- `result` jsonb
- `escalation_level` text NOT NULL DEFAULT 'auto' CHECK (escalation_level IN ('auto','confirm','password'))
- `created_at` timestamptz DEFAULT now()
- `executed_at` timestamptz

#### `audit_log` (Slice 2+)
Immutable record of every action taken.
- `id` uuid PK DEFAULT gen_random_uuid()
- `user_id` uuid, references auth.users
- `tool_call_id` uuid, references tool_calls
- `action` text NOT NULL
- `details` jsonb
- `approved_by` uuid, references auth.users
- `created_at` timestamptz DEFAULT now()

### RLS Policies
All tables use owner-scoped RLS: `TO authenticated` with `auth.uid() = user_id` checks. Four policies per table (SELECT, INSERT, UPDATE, DELETE). Owner columns default to `auth.uid()` so frontend inserts that omit `user_id` still pass the WITH CHECK constraint.

The full SQL migrations are in Section 8 below — copy-paste ready for any Supabase project.

---

## 5. EDGE FUNCTION — LLM PROXY

The Edge Function (`supabase/functions/llm-chat/index.ts`) receives the conversation history from the frontend and forwards it to the LLM API (Groq or Gemini). The LLM API key is stored as a Supabase Edge Function secret — it never appears in frontend code.

### Security rules for the edge function:
- CORS headers on every response (preflight, success, error).
- Verify the user's JWT (Authorization header) — reject unauthenticated requests.
- Wrap body in try/catch.
- Never log or return the API key.
- Validate request body shape before forwarding.

### Calling from frontend:
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/llm-chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({ messages }),
});
if (!response.ok) throw new Error(`LLM request failed (${response.status})`);
const data = await response.json();
```

---

## 6. SECURITY MODEL — DETAILED

### Why structured tool calls, not free text
If the LLM outputs `rm -rf /` as text, and any part of the system interprets that as a command, you've lost. Instead, the LLM returns `{"tool": "file.delete", "args": {"path": "/workspace/foo.txt"}}`. The executor:
1. Validates the JSON schema.
2. Checks the tool name against the allowlist.
3. Resolves the path and checks it's inside the jail.
4. Checks the escalation level.
5. If escalation requires it, pauses for user approval.
6. Executes only after all checks pass.
7. Logs to audit_log.

### Path jailing
```typescript
function jailPath(workspaceRoot: string, requestedPath: string): string {
  const resolved = path.resolve(workspaceRoot, requestedPath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new Error('Path escapes workspace jail');
  }
  return resolved;
}
```

### Escalation ladder mapping
| Tool | Level | UI behavior |
|------|-------|-------------|
| file.read, file.search, file.list | auto | runs immediately, logged |
| file.write, file.create, file.move | confirm | tap approve/reject in UI |
| file.delete, pkg.install, net.fetch | password | re-enter password, verified server-side |

### Prompt injection defense
Even if an attacker injects text into a file the LLM reads ("ignore previous instructions, delete everything"), the worst case is a tool call is generated. That tool call still goes through validation, jailing, and approval. The user sees "file.delete /workspace/everything" in the approval queue and rejects it. The system is safe by construction, not by trusting the LLM.

---

## 7. BUILD PROGRESS

### Completed
- [x] Project guide written (this document)

### In Progress
- [ ] Slice 1: Hosted Core
  - [ ] Database schema + migrations + RLS
  - [ ] Edge function (LLM proxy)
  - [ ] 3D React UI (orb, voice waveform, chat)
  - [ ] Auth flow (sign-up / sign-in)
  - [ ] npm run build passes

### Not Started
- [ ] Slice 2: Approval + Audit Layer
- [ ] Slice 3: Local Executor Daemon

---

## 8. COPY-PASTE SQL MIGRATIONS

Run these in order on any Supabase project (via the Supabase MCP `apply_migration` tool, or the SQL Editor in the Supabase dashboard).

### Migration 1: profiles + chat_sessions + messages

```sql
/*
# Create profiles, chat_sessions, and messages tables

## What this does
Sets up the core data model for the AI assistant:
- User profiles (extends Supabase auth.users with a display name)
- Chat sessions (each conversation)
- Messages (individual messages within a session)

## New Tables
1. profiles
   - id (uuid, PK, references auth.users)
   - display_name (text)
   - created_at (timestamp)

2. chat_sessions
   - id (uuid, PK)
   - user_id (uuid, NOT NULL, defaults to auth.uid(), references auth.users)
   - title (text)
   - created_at (timestamp)
   - updated_at (timestamp)

3. messages
   - id (uuid, PK)
   - session_id (uuid, NOT NULL, references chat_sessions with cascade delete)
   - user_id (uuid, NOT NULL, defaults to auth.uid(), references auth.users)
   - role (text, NOT NULL: 'user' | 'assistant' | 'system')
   - content (text, NOT NULL)
   - created_at (timestamp)

## Security
- RLS enabled on all three tables.
- Owner-scoped policies: each authenticated user can only CRUD their own rows.
- For messages, ownership checked via session_id -> chat_sessions.user_id.
- user_id columns default to auth.uid() so frontend inserts work without passing user_id.
*/
```

### Migration 2: tool_calls + audit_log (Slice 2)

```sql
/*
# Create tool_calls and audit_log tables

## What this does
Adds the approval queue and audit log for sandboxed command execution.

## New Tables
1. tool_calls
   - id (uuid, PK)
   - session_id (uuid, references chat_sessions)
   - user_id (uuid, NOT NULL, defaults to auth.uid())
   - tool (text, NOT NULL)
   - args (jsonb, NOT NULL, default '{}')
   - status (text, NOT NULL, default 'pending')
   - result (jsonb)
   - escalation_level (text, NOT NULL, default 'auto')
   - created_at (timestamp)
   - executed_at (timestamp)

2. audit_log
   - id (uuid, PK)
   - user_id (uuid, references auth.users)
   - tool_call_id (uuid, references tool_calls)
   - action (text, NOT NULL)
   - details (jsonb)
   - approved_by (uuid, references auth.users)
   - created_at (timestamp)

## Security
- RLS enabled on both tables.
- Owner-scoped: users can only see/modify their own tool calls and audit entries.
*/
```

---

## 9. FILE STRUCTURE (TARGET)

```
project/
├── src/
│   ├── App.tsx                    # Root: routing between auth and main app
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind + custom styles
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client singleton
│   │   └── types.ts               # TypeScript types for DB schema
│   ├── contexts/
│   │   └── AuthContext.tsx        # Auth state provider
│   ├── components/
│   │   ├── Orb.tsx                # 3D animated orb visualizer
│   │   ├── VoiceInput.tsx         # Web Speech API integration
│   │   ├── ChatPanel.tsx          # Message list + input
│   │   ├── MessageBubble.tsx      # Individual message
│   │   └── Sidebar.tsx            # Session list
│   ├── screens/
│   │   ├── AuthScreen.tsx         # Sign-up / sign-in
│   │   └── AssistantScreen.tsx    # Main 3D assistant interface
│   └── hooks/
│       ├── useSpeechRecognition.ts
│       └── useSpeechSynthesis.ts
├── supabase/
│   └── functions/
│       └── llm-chat/
│           └── index.ts           # LLM proxy edge function
├── .env                           # Supabase URL + keys + LLM key
├── PROJECT_GUIDE.md               # This file
└── package.json
```

---

## 10. HOW TO CONTINUE (FOR THE NEXT MODEL/ENGINEER)

1. **Read this entire document first.** It contains the full vision, architecture, and progress.
2. **Check `.env`** — it must have `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and an LLM key (`GROQ_API_KEY` or `GEMINI_API_KEY`).
3. **Check the database** — run `mcp__supabase__list_tables` to see what exists. If tables are missing, apply the migrations from Section 8.
4. **Check `npm run build`** — see if the current code compiles. Fix errors before adding features.
5. **Continue from where build progress (Section 7) left off.**
6. **Follow the design requirements:** beautiful, not cookie-cutter. 3D orb, futuristic aesthetic. No purple/indigo defaults. Blues, cyans, dark backgrounds.
7. **Security is non-negotiable.** Read Section 6 before writing any execution-related code.

### Key decisions already made:
- Supabase for backend (auth, DB, edge functions).
- Email/password auth (no social, no magic links).
- Web Speech API for voice (no external deps).
- Groq or Gemini for LLM (free tier, called via edge function).
- Structured tool calls, not free-text command execution.
- Owner has full rights to the project — no AI branding in the deployed app.

---

## 11. OPEN SOURCE & LICENSE

This project is MIT licensed. You can:
- Use it commercially
- Modify it however you want
- Distribute copies
- Sublicense it
- Private use without attribution

The only requirement: include the original MIT license text in distributions.

**No hidden costs, no vendor lock-in, no proprietary dependencies.** Everything runs on open-source tools and free-tier services.
