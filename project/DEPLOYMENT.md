# Deployment Guide

## Quick Deploy to Vercel (Recommended)

### Prerequisites
- GitHub account
- Vercel account (free tier)
- Supabase project with migrations applied

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: JARVIS v0.1"
   git branch -M main
   git remote add origin https://github.com/yourusername/jarvis.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

   Or use the Vercel dashboard:
   - Visit [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repo
   - Framework preset: Vite
   - Root directory: `project`
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Add Environment Variables in Vercel Dashboard**
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

4. **Deploy Edge Function to Supabase**
   ```bash
   cd project
   npx supabase login
   npx supabase link --project-ref your_project_ref
   npx supabase functions deploy llm-chat
   npx supabase secrets set GROQ_API_KEY=your_groq_key
   npx supabase secrets set SUPABASE_URL=your_supabase_url
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

5. **Apply Database Migrations**
   
   Via Supabase CLI:
   ```bash
   npx supabase db push
   ```

   Or via SQL Editor in Supabase Dashboard:
   - Run `supabase/migrations/20260717120840_create_core_tables.sql`
   - Run `supabase/migrations/20260915000000_add_tool_system.sql`

### Verify Deployment

1. Visit your Vercel URL
2. Sign up with a test account
3. Create a new chat
4. Test voice input (click microphone)
5. Test tool calls: "Create a reminder for 5pm to check email"
6. Check approval queue appears in UI

---

## Deploy to Netlify (Alternative)

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

In Netlify dashboard, add same environment variables.

---

## Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your keys
nano .env

# Run dev server
npm run dev
```

Visit `http://localhost:5173`

---

## Environment Variables Reference

| Variable | Required | Where to Get It | Used By |
|----------|----------|-----------------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase Dashboard → Settings → API | Frontend |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase Dashboard → Settings → API | Frontend |
| `GROQ_API_KEY` | Yes | [console.groq.com](https://console.groq.com/keys) | Edge Function |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Dashboard → Settings → API | Edge Function |

---

## Post-Deployment Checklist

- [ ] Database migrations applied (check Supabase SQL Editor)
- [ ] Edge function deployed (check Supabase Functions dashboard)
- [ ] Edge function secrets set (GROQ_API_KEY, etc)
- [ ] Environment variables set in Vercel/Netlify
- [ ] Test user signup flow
- [ ] Test voice input (requires HTTPS for Web Speech API)
- [ ] Test tool call approval flow
- [ ] Check browser console for errors

---

## Custom Domain (Optional)

### Vercel
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `jarvis.yourdomain.com`)
3. Follow DNS configuration instructions

### Netlify
1. Netlify Dashboard → Domain Settings → Add Custom Domain
2. Configure DNS with provided values

---

## Troubleshooting

### "Speech recognition not supported"
- Must use HTTPS (localhost or deployed URL)
- Chrome/Edge only (Safari has limited support)
- Grant microphone permission when prompted

### "Missing authorization header"
- Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
- Verify user is logged in (check AuthContext)

### "No LLM API key configured"
- Run: `npx supabase secrets set GROQ_API_KEY=your_key`
- Redeploy edge function after setting secrets

### Tool calls not appearing
- Check migrations ran successfully
- Verify `tool_calls` table exists in Supabase
- Check browser console for errors

### Build fails
- Run `npm run typecheck` locally first
- Check all imports resolve correctly
- Verify `.env` file exists (or `.env.example` for Vercel)

---

## Updating Deployment

```bash
# Pull latest changes
git pull

# Update dependencies
npm install

# Build and test locally
npm run build
npm run preview

# Push to production
git push origin main

# Vercel auto-deploys on push
# Or manually: vercel --prod
```

---

## Monitoring

- **Supabase Dashboard**: Database usage, edge function logs, auth metrics
- **Vercel/Netlify Dashboard**: Build logs, bandwidth, error rates
- **Browser DevTools**: Console errors, network requests, performance

---

## Cost Tracking (All Free Tier)

| Service | Free Tier Limit | Current Usage Visibility |
|---------|----------------|--------------------------|
| Supabase | 500MB DB, 2GB storage, 50K MAU | Dashboard → Settings → Usage |
| Groq | 14,400 requests/day | [console.groq.com](https://console.groq.com) |
| Vercel | 100GB bandwidth/month | Dashboard → Usage |
| Netlify | 100GB bandwidth/month | Dashboard → Bandwidth |

All limits renew monthly. No credit card required for free tiers.
