# JARVIS Development Changelog

## v0.2.0 — Tool Call System (2026-09-15)

### Added
- **Structured tool call system** — LLM returns JSON tool calls, not raw commands
- **Approval queue UI** — pending operations show in sidebar with approve/reject buttons
- **Tool registry** (`src/lib/tools.ts`) with execution engine
- **12 tools implemented**:
  - File operations: `file.read`, `file.write`, `file.search`, `file.list`, `file.delete`
  - Tasks: `task.create`, `task.list`, `task.complete`, `task.delete`
  - Reminders: `reminder.create`, `reminder.list`, `reminder.delete`
- **Database schema** for `tool_calls` and `audit_log` tables
- **Three-tier escalation system**:
  - Auto: read operations (logged only)
  - Confirm: write operations (tap to approve)
  - Password: destructive operations (re-auth required — UI pending)
- **Real-time tool call updates** via Supabase Realtime
- **Audit logging** — immutable record of all actions

### Changed
- Edge function now parses tool calls from LLM response
- Edge function stores tool calls in database with escalation levels
- Updated system prompt with tool usage instructions
- LLM max_tokens increased to 2048 for tool call responses

### Security
- Tool execution sandboxed in browser (File System Access API placeholders)
- All tool calls require user approval (except auto-tier)
- Full audit trail with user_id, timestamp, args, and results
- RLS policies ensure users only see their own tool calls

### Documentation
- Created `DEPLOYMENT.md` — full deployment guide for Vercel/Netlify
- Updated `README.md` with current feature status
- Updated `PROJECT_GUIDE.md` — removed AI tool branding, added MIT license section
- Created `LICENSE` — MIT license
- Updated `package.json` — proper project name, version, metadata

### Technical Debt
- File operations return placeholder errors (File System Access API not yet integrated)
- Password-tier approval not yet enforced in UI
- No file path jailing yet (pending File System Access API integration)
- Reminder scheduling not yet active (notifications show but don't trigger)

---

## v0.1.0 — Basic Voice Chat (2026-09-14)

### Initial Release
- Voice input via Web Speech API
- Voice output via Speech Synthesis API
- Multi-session conversations
- Supabase authentication (email/password)
- Chat history stored in Supabase
- LLM integration via Groq (Llama 3.3 70B)
- 3D orb visualizer with state animations
- Responsive UI with Tailwind CSS
- Real-time message updates

### Database Schema
- `profiles` — user display names
- `chat_sessions` — conversation containers
- `messages` — chat history with RLS

### Security
- Row-level security on all tables
- Owner-scoped policies (users only see own data)
- JWT-based authentication via Supabase Auth
- Edge function proxies LLM requests (API key never exposed to frontend)

---

## Roadmap

### v0.3.0 — File System Integration (Next)
- [ ] Implement File System Access API
- [ ] Directory picker UI
- [ ] Path jailing and validation
- [ ] File content preview in approval UI
- [ ] File search across granted directories
- [ ] Handle permission revocation gracefully

### v0.4.0 — Calendar Integration
- [ ] Google Calendar OAuth flow
- [ ] View events tool
- [ ] Create/edit/delete event tools
- [ ] Calendar sync with reminders
- [ ] Conflict detection

### v0.5.0 — Production Hardening
- [ ] Password-tier approval enforcement
- [ ] Rate limiting on tool calls
- [ ] Better error messages
- [ ] Loading states for all async operations
- [ ] Retry logic for failed tool executions
- [ ] User settings panel (voice preferences, auto-approve toggles)

### v0.6.0 — Reminders & Notifications
- [ ] Background reminder scheduler (Service Worker)
- [ ] Browser notifications at reminder time
- [ ] Snooze functionality
- [ ] Recurring reminders
- [ ] Reminder edit UI

### v1.0.0 — Desktop App
- [ ] Electron wrapper
- [ ] Local file system access (no browser sandbox)
- [ ] System tray integration
- [ ] Global hotkey for voice activation
- [ ] Auto-start on boot (optional)
- [ ] Native notifications

---

## Migration Notes

### From v0.1 to v0.2
1. Apply new migration: `supabase/migrations/20260915000000_add_tool_system.sql`
2. Redeploy edge function (updated system prompt + tool parsing)
3. No breaking changes to existing features

---

## Breaking Changes

None yet. All changes are additive.

---

## Contributors

See commit history for full list.

---

## License

MIT — see LICENSE file.
