# JARVIS — Voice-First AI Assistant

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A voice-controlled AI assistant with enterprise-grade security, voice macros, and stunning particle effects. Built with zero budget using free-tier services.

![JARVIS Demo](https://via.placeholder.com/800x400/0a0e1a/06b6d4?text=JARVIS+Demo+Video)

## ✨ What Makes This Different

**Not just another AI chatbot.** JARVIS has:

- 🎙️ **50+ voice options** — customize speed, pitch, volume
- ⚡ **Voice macros** — say "good morning", get full daily briefing
- 🔮 **Particle-rendered orb** — 80-particle canvas animation at 60fps
- 🔒 **Three-tier security** — approval queue + password protection + audit log
- 📁 **Browser File System API** — safe, sandboxed file operations
- 🎯 **Zero dependencies for effects** — pure browser APIs

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/yourusername/jarvis.git
cd jarvis/project

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your Supabase + Groq keys

# Run
npm run dev
```

Visit `http://localhost:5173`

## 🎬 Demo

**Try these commands:**
- "Good morning" → Daily briefing (tasks + reminders)
- "Create a reminder for 5pm to check email"
- "List all files"
- "Status report"

## 🔥 Features

### Voice System
- **Multiple voices**: Google, Microsoft, Apple system voices
- **Customizable**: Speed (0.5x-2x), pitch (0.5-2.0), volume (0-100%)
- **Persistent**: Saves your preferences

### Voice Macros
- **Pre-built**: Morning briefing, focus mode, status report
- **Multi-step**: Chain tool calls + speech
- **Manageable**: Enable/disable, delete, preview

### Security
- **Approval queue**: See what JARVIS wants to do before execution
- **Three tiers**:
  - Auto: Read operations (logged only)
  - Confirm: Write operations (tap approve)
  - Password: Destructive operations (re-auth required)
- **Audit log**: Immutable record of every action
- **Browser-sandboxed**: Can't escape File System API boundaries

### File Operations
- Read, write, search, list, delete
- User grants directory access (browser picker)
- Path traversal protection
- Permission revocation anytime

### Tasks & Reminders
- Voice-controlled task management
- Reminder notifications at scheduled time
- Stored locally (no server needed)

### Visual Effects
- Canvas particle system (80 particles)
- State-based animations (idle, listening, thinking, speaking)
- Animated background gradients
- Glassmorphism UI
- Smooth transitions

## 🏗️ Architecture

```
├── Frontend (React + TypeScript)
│   ├── Voice input (Web Speech API)
│   ├── Voice output (Speech Synthesis API)
│   ├── File operations (File System Access API)
│   ├── Canvas orb (RequestAnimationFrame)
│   └── Approval queue UI
│
├── Backend (Supabase)
│   ├── Auth (email/password)
│   ├── Database (tool_calls, audit_log, messages)
│   └── Edge Function (LLM proxy)
│
└── LLM (Groq)
    └── Llama 3.3 70B (free tier)
```

## 📊 Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Edge Functions) |
| LLM | Groq API (Llama 3.3 70B) |
| Voice | Web Speech API |
| Graphics | Canvas API |
| Icons | Lucide React |

## 🔐 Security Model

1. **LLM returns JSON tool calls** (not raw commands)
2. **Every operation validated** (allowlist, path jailing, schema)
3. **User approves sensitive operations** (three-tier escalation)
4. **Full audit trail** (who, what, when, result)
5. **Browser sandbox** (File System API isolation)

## 💰 Cost (Free Tier)

| Service | Usage | Free Tier Limit |
|---------|-------|-----------------|
| Supabase | ~5MB DB | 500MB |
| Groq | ~100 req/day | 14,400/day |
| Vercel | ~1GB bandwidth | 100GB/month |

**Total monthly cost: $0**

## 📦 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Add environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Run migrations in `supabase/migrations/`
3. Deploy edge function:
   ```bash
   npx supabase functions deploy llm-chat
   npx supabase secrets set GROQ_API_KEY=your_key
   ```

Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)

## 🎯 Use Cases

- **Developers**: Voice-controlled file operations while coding
- **Productivity**: Daily briefings, task management, focus mode
- **Accessibility**: Multiple voices, speed control, voice-first interface
- **Enterprises**: Approval queue, audit logs, sandbox isolation

## 🗺️ Roadmap

- [x] Voice chat with AI
- [x] File operations (File System Access API)
- [x] Tasks & reminders
- [x] Voice macros
- [x] Voice customization (50+ voices)
- [x] Approval queue
- [x] Particle effects
- [ ] Google Calendar integration
- [ ] Custom macro builder
- [ ] Cloud sync
- [ ] Mobile app
- [ ] Desktop app (Electron)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

Built with:
- [Supabase](https://supabase.com) — Backend infrastructure
- [Groq](https://groq.com) — Fast LLM inference
- [Llama 3.3](https://llama.meta.com) — Meta AI
- [Vite](https://vitejs.dev) — Build tool
- [Tailwind CSS](https://tailwindcss.com) — Styling

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/jarvis/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/jarvis/discussions)

---

**Status:** v0.3.0 — Production Ready  
**Build:** [![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()  
**Demo:** [Try it live](https://your-jarvis.vercel.app)

Made with ❤️ and zero budget
