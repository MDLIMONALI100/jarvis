/**
 * Local scheduler for development / self-hosting without Cloudflare Cron Triggers.
 *   npm run cron:local
 * Reads APP_URL and CRON_SECRET from .env.
 */
import { readFileSync } from "fs";

try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set");
  process.exit(1);
}

const MEETINGS_MS = 5 * 60_000;
const EMAILS_MS = 15 * 60_000;

async function hit(path: string) {
  const t = new Date().toLocaleTimeString();
  try {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${secret}` } });
    console.log(`[${t}] ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.error(`[${t}] ${path} failed:`, e instanceof Error ? e.message : e);
  }
}

console.log(`Local cron → ${base} (meetings every 5m, emails every 15m)`);
hit("/api/cron/meetings");
hit("/api/cron/emails");
setInterval(() => hit("/api/cron/meetings"), MEETINGS_MS);
setInterval(() => hit("/api/cron/emails"), EMAILS_MS);
