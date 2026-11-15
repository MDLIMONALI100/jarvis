# J.A.R.V.I.S. — Setup Guide

Everything works out of the box in **demo / mock mode**: a demo inbox, a demo
calendar, simulated calls and simulated WhatsApp messages, plus an offline
rule-based command parser. Add real keys one integration at a time from
**/admin → API & Webhooks**. You never need to edit `.env` for API keys.

---

## 1. Run it locally (5 minutes)

Requirements: Node.js 20+.

```bash
npm install
```

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

| Variable          | What it is                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `JARVIS_PASSWORD` | Your password/PIN for the HUD and admin panel (min. 4 characters).                             |
| `AUTH_SECRET`     | 32+ random characters. Signs your login cookie **and** encrypts API keys stored in the DB.     |
| `CRON_SECRET`     | Random token that protects `/api/cron/*` and the automation endpoints.                         |

Generate the secrets with:

```bash
openssl rand -base64 48
```

> ⚠️ If you change `AUTH_SECRET` later, stored API keys can no longer be decrypted.
> Re-enter them in /admin.

Create the local D1 database (an SQLite file under `.wrangler/`) and add sample contacts:

```bash
npm run setup
```

Start the app:

```bash
npm run dev
```

Open http://localhost:3000 and log in with `JARVIS_PASSWORD`.

Try: *"Which emails are important today?"*, *"Send a WhatsApp to Mom saying I'll be late"*,
*"Remind me about my next meeting"*, *"Give me my daily briefing"*.

Voice input needs Chrome, Edge or Safari, and a secure origin (`localhost` or HTTPS).

To test the exact Cloudflare build locally, copy the three secrets into a `.dev.vars` file and run:

```bash
npm run preview
```

---

## 2. Add your API keys (Admin → API & Webhooks)

Keys are encrypted with AES-256-GCM before being stored and are only ever shown
masked (`sk-a••••••••1234`). Leaving a key field empty keeps the stored value; the
✕ button clears it. Keys can alternatively be put in `.env` (see `.env.example`);
admin values win when both are set.

### AI language model (pick one)

| Provider  | Where to get a key                              | Default model        |
| --------- | ----------------------------------------------- | -------------------- |
| Anthropic | https://console.anthropic.com → API Keys        | `claude-opus-5-5`    |
| OpenAI    | https://platform.openai.com/api-keys            | `gpt-4o-mini`        |
| Gemini    | https://aistudio.google.com/apikey              | `gemini-2.0-flash`   |

Choose the provider, paste the key, **Save**, then **Test AI connection**.
You can override the model name in the field next to the provider. If the AI call
ever fails, Jarvis falls back to the offline parser and rule-based email scoring,
and logs the error.

Anthropic requests use the server-side refusal fallback (`fallbacks: "default"`),
so a declined request is retried on a suitable model automatically.

### Phone calls

**Option A: Vapi.ai** (conversational AI voice; you can talk back)

1. Sign up at https://dashboard.vapi.ai, then buy or import a phone number (*Phone Numbers*).
2. Copy the **private API key** (*Org → API Keys*) and the **phone number ID**.
3. Optional: build an assistant in Vapi and paste its **assistant ID**. Jarvis
   overrides its first message with the alert text. Without one, a built-in
   transient assistant reads the alert and answers short follow-ups.

**Option B: Twilio Voice** (plain text-to-speech)

1. https://console.twilio.com → copy **Account SID** and **Auth Token**.
2. Buy a voice-capable number and enter it as **Twilio caller number**.
3. Trial accounts can only call **verified** numbers: verify your own phone first.

Then go to **Calls & Alerts**, enter your personal phone number in international
format (`+447700900123`), save, and press **Test outbound call**.

### WhatsApp

**Option A: WhatsApp Business Cloud API (Meta)**

1. https://developers.facebook.com → *Create App* → *Business* → add **WhatsApp**.
2. In *WhatsApp → API Setup*, copy the **Phone number ID**. Create a **permanent
   token** through a System User in Business Settings (the temporary token expires in 24h).
3. Enter a random **Webhook verify token** and the **App secret** (*App settings → Basic*) in admin.
4. In *WhatsApp → Configuration → Webhook*, set the callback URL to
   `https://YOUR_DOMAIN/api/whatsapp/webhook`, use the same verify token, and
   subscribe to the `messages` field.

> Meta only delivers free-form text to a number that has messaged your business
> number in the last 24 hours. For cold outreach you need an approved template.
> Message yourself first, or use Twilio's sandbox for testing.

**Option B: Twilio WhatsApp**

1. Console → *Messaging → Try it out → Send a WhatsApp message*, then join the
   sandbox from each phone (send the `join <code>` text).
2. Sender = `+14155238886` (sandbox) or your approved number.
3. Set *When a message comes in* to `https://YOUR_DOMAIN/api/whatsapp/webhook`.
   Signatures are verified with your auth token, so the URL must match your live domain exactly.

Add people in **Admin → Contacts** with nicknames (e.g. `Mom` → `mother, mum`)
so voice commands resolve correctly. Mark key people as **VIP** to boost their emails.

### Google (Gmail + Calendar)

1. https://console.cloud.google.com → create a project.
2. *APIs & Services → Library*: enable **Gmail API** and **Google Calendar API**.
3. *OAuth consent screen*: choose External, add yourself as a **Test user**, and add the scopes
   `gmail.readonly` and `calendar.readonly`.
4. *Credentials → Create credentials → OAuth client ID → Web application*.
   Authorized redirect URI: `https://YOUR_DOMAIN/api/google/callback`
   (locally: `http://localhost:3000/api/google/callback`). Admin shows the exact value to paste.
5. Paste the **client ID** and **client secret** in admin, **Save**, then click **Connect Google**.

Access is read-only. While the consent screen is in "Testing" status, Google expires
refresh tokens after 7 days; publish the app (no verification is needed for
personal use with your own account) to keep the connection.

If Google returns no refresh token, remove the app at
https://myaccount.google.com/permissions and connect again.

### n8n bridge (optional)

Turn on **Enable n8n bridge** and paste webhook URLs for the actions you want n8n to
handle. Actions without a URL keep running natively.

| Action          | Payload sent to n8n (JSON)                                  |
| --------------- | ----------------------------------------------------------- |
| `whatsapp`      | `{ action, to, body, contactName, reason }`                 |
| `call`          | `{ action, to, message, reason }`                           |
| `meetingAlert`  | `{ action, meeting, message, to }` (replaces native call)   |
| `emailTriage`   | `{ action, email, message }` (for each urgent email)        |
| `command`       | `{ action, text, parsed }`: respond `{ "reply": "..." }` to override Jarvis' answer |

Every request carries `X-Jarvis-Secret` if you set a shared secret. n8n can also
call back into Jarvis with `Authorization: Bearer $CRON_SECRET` on
`/api/command`, `/api/whatsapp/send`, `/api/call/trigger`, `/api/emails/sync` and
`/api/calendar/check`.

---

## 3. Configure the cron jobs

Two endpoints do the background work. Both require `Authorization: Bearer $CRON_SECRET`
(or `?key=$CRON_SECRET` for schedulers that can't set headers).

| Endpoint             | Schedule        | What it does                                                         |
| -------------------- | --------------- | -------------------------------------------------------------------- |
| `/api/cron/meetings` | every 5 minutes | Calls you for meetings starting within *lead* to *lead + window* minutes. |
| `/api/cron/emails`   | every 15 minutes | Fetches unread Gmail, AI-scores it, alerts on urgent mail (score ≥ threshold). |

Each calendar event instance gets one call at most: the reminder row is claimed
atomically before dialing. If a call fails outright, the claim is released so the
next run retries. Quiet hours suppress meeting calls; urgent email alerts are
allowed through unless you turn that off.

**On Cloudflare this is already done.** `wrangler.jsonc` defines two free Cron Triggers
(`*/5` and `*/15`), and `custom-worker.ts` calls the routes above with your `CRON_SECRET`.
You can watch them run under Worker → **Logs**. Nothing else needs to be set up.

If you host somewhere else, use one of these options:

**Any Linux server** (crontab -e):

```cron
*/5  * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/meetings >/dev/null
*/15 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/cron/emails   >/dev/null
```

**External scheduler** (cron-job.org, GitHub Actions, n8n Schedule node): GET
`https://YOUR_DOMAIN/api/cron/meetings?key=YOUR_CRON_SECRET` every 5 minutes, and the same for `/api/cron/emails` every 15 minutes.

**Local development**: run this next to `npm run dev`:

```bash
npm run cron:local
```

---

## 4. Install on your phone (PWA)

The app must be served over **HTTPS** (any real deployment is; for local testing use
a tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`,
and set `APP_URL` to that URL).

- **iPhone (Safari):** open the site → Share button → **Add to Home Screen**.
- **Android (Chrome):** open the site → ⋮ menu → **Install app** (or *Add to Home screen*).

### Turn on alerts (free push notifications)

After installing, open J.A.R.V.I.S. from the home screen and tap the **bell** in the top bar,
or go to **Admin → Calls & Alerts → Enable on this device**, then **Send test notification**.
Meeting reminders and urgent-email alerts then arrive as notifications, at no cost and with no limit.
iPhone needs iOS 16.4+ and the app opened from the home screen; Android works in Chrome.
Set the `APP_URL` secret to your live https address: Apple's push service (iPhone, iPad, Mac Safari)
rejects notifications without it (`403 BadJwtToken`).
Phone calls (Vapi/Twilio) are optional and only used if you configure a voice provider.

It launches full-screen with its own icon. Long-press the icon on Android for the
*Daily Briefing* and *Call Me Now* shortcuts. Grant microphone permission the first
time you tap the orb. On iOS, voice recognition requires iOS 14.5+ Safari.

---

## 5. Deploy to Cloudflare (free)

The app runs as a **Cloudflare Worker** (Next.js via OpenNext), the database is **Cloudflare D1**,
and background jobs use **Cron Triggers**. All three are on Cloudflare's free plan.

Static files are embedded in the Worker script by `scripts/embed-assets.mjs`, so a
deploy is a single script upload (about 2.7 MiB compressed, under the free plan's 3 MiB limit).

### Option A: from the Cloudflare dashboard (no terminal needed)

1. Go to https://dash.cloudflare.com, sign up or log in, then open **Workers & Pages → Create → Import a repository**.
   Connect GitHub and pick `jarvis`.
2. Configure the project:
   - **Project name:** `jarvis` (must match `name` in `wrangler.jsonc`)
   - **Build command:** `npm run build:cf`
   - **Deploy command:** `npx wrangler deploy && npx wrangler d1 migrations apply jarvis-db --remote`
3. Click **Deploy**. The first deploy automatically creates the D1 database `jarvis-db`, then creates the tables.
4. Open the Worker's **Settings → Variables and Secrets** and add three values, each with type **Secret**:
   `JARVIS_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET` (random strings: 40+ characters for
   `AUTH_SECRET`, 30+ for `CRON_SECRET`). Saving them redeploys the Worker.
5. Open `https://jarvis.<your-subdomain>.workers.dev`, log in, and you're live.

Every push to `main` redeploys automatically.

### Option B: from your computer (CLI)

```bash
npx wrangler login
```

```bash
npx wrangler secret put JARVIS_PASSWORD
```

Repeat the last command for `AUTH_SECRET` and `CRON_SECRET`, then deploy:

```bash
npm run deploy
```

### After the first deploy

- **Custom domain (optional):** Worker → **Settings → Domains & Routes**. Then add an
  `APP_URL` secret with that URL. Without it, the app uses whatever address the request came in on.
- Set the Google redirect URI and the WhatsApp webhook URL to your live domain (section 2).
- Install the PWA on your phone (section 4).

### Schema changes later

Edit `prisma/schema.prisma`, then generate a migration file with the next number:

```bash
npx prisma migrate diff --from-local-d1 --to-schema-datamodel prisma/schema.prisma --script > migrations/0002_change.sql
```

Push to GitHub; the deploy command applies new migrations. To apply one by hand, run `npm run db:migrate:remote`.

### Security notes

- Every page and API route requires the session cookie (HttpOnly, SameSite=Lax,
  Secure in production, 30-day expiry), except: login, health, cron (Bearer secret),
  and the WhatsApp webhook (verified by Meta/Twilio signature).
- Login attempts are rate-limited with exponential back-off per IP.
- API keys are encrypted at rest and never sent back to the browser in clear text.
- Inputs are validated with zod. Every call, message, scan, config change, login and
  error is written to the audit log (Admin → Logs).
- Use a long `JARVIS_PASSWORD` if the app is reachable on the public internet.

---

## Troubleshooting

| Symptom                               | Fix                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| "AUTH_SECRET must be set"             | Add a 32+ character `AUTH_SECRET` secret (Cloudflare) or to `.env` (local).             |
| "no such table" errors after deploy   | The migration step didn't run. Run `npm run db:migrate:remote`, or open the D1 database → **Console** in the dashboard and paste the contents of `migrations/0001_init.sql`. |
| Login says JARVIS_PASSWORD not configured | Add the `JARVIS_PASSWORD` secret under Worker → Settings → Variables and Secrets. |
| Orb does nothing / "not supported"    | Use Chrome, Edge or Safari over HTTPS or localhost; allow microphone access.            |
| Stored keys suddenly show as "Not set" | `AUTH_SECRET` changed. Re-enter the keys.                                               |
| Google "redirect_uri_mismatch"        | The redirect URI in Google Console must exactly match the one shown in admin (your live domain). |
| WhatsApp sends "fail" with error 131047 | The recipient's 24h window is closed (Meta). Use a template or message from the phone first. |
| Twilio WhatsApp webhook returns 403   | The URL Twilio calls must match your live domain exactly (signature check). Set `APP_URL` if you're behind a proxy. |
| No meeting calls                      | Check Admin → Logs → CALENDAR_CHECK entries, confirm cron is running, phone is set, quiet hours are off. |
