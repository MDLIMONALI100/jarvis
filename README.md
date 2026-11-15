# J.A.R.V.I.S.

A voice-first personal AI assistant: a mobile-installable PWA with an animated HUD, WhatsApp
messaging, outbound phone calls, AI email triage and meeting call reminders.

**→ Setup, API keys, cron and PWA install: [SETUP.md](./SETUP.md)**

```bash
npm install && cp .env.example .env   # then fill JARVIS_PASSWORD / AUTH_SECRET / CRON_SECRET
npm run setup && npm run dev
```

## Architecture

```
Browser / PWA ──────────────────────────────────────────────────────────────
  /           HUD: orb (Web Speech STT + TTS, mic analyser), chat, dashboard cards
  /admin      Integrations · Contacts · AI Rules · Calls & Alerts · Logs
  /login      password/PIN → signed JWT cookie
        │
middleware.ts  session check (jose, edge) · Bearer CRON_SECRET for automation routes
        │
API routes (src/app/api) ─ thin: validate (zod) → call a service → JSON
  command  emails[/sync]  calendar[/check|/events|/:id]  whatsapp[/send|/webhook|/messages]
  call/trigger  briefing  dashboard  cron/{meetings,emails}  google/{auth,callback}
  admin/{config,contacts,logs,test,status}  auth/{login,logout}  health
        │
Service layer (src/lib/services) ─ every integration has a mock fallback
  command.ts       intent → action → spoken reply
  intent.ts        LLM intent parsing (structured JSON) + offline regex parser
  llm.ts           Anthropic / OpenAI / Gemini behind one completeJson()
  email-triage.ts  Gmail fetch → AI or heuristic 1-10 score → DB → urgent alerts
  meetings.ts      Calendar sync → MeetingReminder → dedup'd call alerts
  voice.ts         Vapi | Twilio | n8n | simulated
  whatsapp.ts      Meta Cloud API | Twilio | n8n | simulated
  google.ts        OAuth2, Gmail + Calendar REST, demo data
  n8n.ts           optional per-action webhook forwarding
  contacts.ts      fuzzy name/nickname resolution
  logger.ts        ActionLog audit trail
        │
Prisma ─ PostgreSQL (Supabase); SQLite optional for offline dev
  UserConfig (encrypted secrets) · Contact · EmailLog · MeetingReminder · WhatsAppMessage · ActionLog
```

## Scripts

| Command                   | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `npm run dev`             | Dev server on :3000                             |
| `npm run setup`           | Create/patch DB schema + seed sample contacts   |
| `npm run cron:local`      | Local scheduler hitting the cron endpoints      |
| `npm run db:use-sqlite`   | Optional offline SQLite DB for local dev        |
| `npm run db:studio`       | Browse the database                             |
| `npm run build && npm start` | Production build / server                    |
| `npm run typecheck`       | TypeScript check                                |
| `npm run icons`           | Regenerate PNG icons from `public/icons/icon.svg` (needs Playwright) |
