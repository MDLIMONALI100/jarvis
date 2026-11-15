import "server-only";
import { prisma } from "../db";
import { encrypt } from "../crypto";
import type { ResolvedConfig } from "../config";
import type { CalendarEvent, RawEmail } from "../types";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export const googleRedirectUri = () => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/google/callback`;

export function googleLive(cfg: ResolvedConfig) {
  return Boolean(cfg.googleClientId && cfg.googleClientSecret && cfg.googleRefreshToken);
}

export function googleAuthUrl(cfg: ResolvedConfig, state: string) {
  const p = new URLSearchParams({
    client_id: cfg.googleClientId!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeGoogleCode(cfg: ResolvedConfig, code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.googleClientId!,
      client_secret: cfg.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as { refresh_token?: string; access_token?: string; id_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(data.error_description || "Google token exchange failed");
  let email: string | null = null;
  if (data.id_token) {
    try {
      email = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString()).email ?? null;
    } catch {}
  }
  await prisma.userConfig.update({
    where: { id: "singleton" },
    data: {
      ...(data.refresh_token ? { googleRefreshToken: encrypt(data.refresh_token) } : {}),
      googleEmail: email,
    },
  });
  if (!data.refresh_token && !cfg.googleRefreshToken) {
    throw new Error("Google returned no refresh token. Remove the app at myaccount.google.com/permissions and connect again.");
  }
  return { email };
}

// Access tokens live ~1h; cache in memory per server instance.
let tokenCache: { token: string; exp: number; for: string } | null = null;

async function accessToken(cfg: ResolvedConfig): Promise<string> {
  if (tokenCache && tokenCache.for === cfg.googleRefreshToken && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.googleClientId!,
      client_secret: cfg.googleClientSecret,
      refresh_token: cfg.googleRefreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google auth failed: ${data.error_description || data.error || res.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000, for: cfg.googleRefreshToken };
  return data.access_token;
}

async function gget<T>(cfg: ResolvedConfig, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(cfg)}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

// ── Gmail ────────────────────────────────────────────────────────────────────
interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
}

function findText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const t = findText(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
  }
  return "";
}

function parseFrom(v: string): { name: string; email: string } {
  const m = v.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim() || m[2], email: m[2].trim().toLowerCase() };
  return { name: v.trim(), email: v.trim().toLowerCase() };
}

export async function fetchUnreadEmails(cfg: ResolvedConfig, max = 20): Promise<RawEmail[]> {
  if (!googleLive(cfg)) return mockEmails();
  const list = await gget<{ messages?: { id: string }[] }>(
    cfg,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: "is:unread newer_than:2d -category:promotions -category:social", maxResults: String(max) })}`,
  );
  const out: RawEmail[] = [];
  for (const { id } of list.messages ?? []) {
    const msg = await gget<{ id: string; threadId: string; snippet: string; internalDate: string; payload: GmailPart }>(
      cfg,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    );
    const h = (n: string) => msg.payload.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    const from = parseFrom(h("from"));
    out.push({
      id: msg.id,
      threadId: msg.threadId,
      fromName: from.name,
      fromEmail: from.email,
      subject: h("subject") || "(no subject)",
      snippet: msg.snippet ?? "",
      body: findText(msg.payload).replace(/\s+/g, " ").slice(0, 4000),
      receivedAt: new Date(Number(msg.internalDate)),
    });
  }
  return out;
}

// ── Calendar ─────────────────────────────────────────────────────────────────
export async function fetchEvents(cfg: ResolvedConfig, from: Date, to: Date): Promise<CalendarEvent[]> {
  if (!googleLive(cfg)) return mockEvents().filter((e) => e.start >= from && e.start <= to);
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const data = await gget<{
    items?: {
      id: string;
      summary?: string;
      status?: string;
      location?: string;
      hangoutLink?: string;
      start: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: { self?: boolean; responseStatus?: string }[];
    }[];
  }>(cfg, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.googleCalendarId || "primary")}/events?${params}`);
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.start.dateTime) // skip all-day events
    .filter((e) => !e.attendees?.some((a) => a.self && a.responseStatus === "declined"))
    .map((e) => ({
      id: e.id,
      title: e.summary || "Untitled event",
      start: new Date(e.start.dateTime!),
      end: e.end?.dateTime ? new Date(e.end.dateTime) : undefined,
      location: e.location,
      meetLink: e.hangoutLink,
    }));
}

// ── Mock data (used until Google is connected) ──────────────────────────────
function mockEvents(): CalendarEvent[] {
  const now = Date.now();
  const q = 15 * 60_000;
  // Anchored to 15-minute / hour grids so ids+times stay stable between checks.
  const nextQuarter = Math.floor(now / q) * q + q;
  const hour = 60 * 60_000;
  const nextHour = Math.ceil(now / hour) * hour;
  return [
    { id: `mock-standup-${nextQuarter}`, title: "Team stand-up", start: new Date(nextQuarter), end: new Date(nextQuarter + q), meetLink: "https://meet.google.com/abc-defg-hij", isMock: true },
    { id: `mock-review-${nextHour}`, title: "Design review with Pepper", start: new Date(nextHour + 2 * hour), end: new Date(nextHour + 3 * hour), location: "Conference Room A", isMock: true },
    { id: `mock-investor-${nextHour}`, title: "Investor call — Q4 roadmap", start: new Date(nextHour + 5 * hour), end: new Date(nextHour + 5.5 * hour), meetLink: "https://meet.google.com/xyz-uvwx-rst", isMock: true },
  ];
}

function mockEmails(): RawEmail[] {
  const day = new Date().toISOString().slice(0, 10);
  const ago = (m: number) => new Date(Date.now() - m * 60_000);
  return [
    { id: `mock-${day}-1`, fromName: "Pepper Potts", fromEmail: "pepper@starkindustries.com", subject: "URGENT: Board meeting moved to 3pm today", snippet: "The board needs your sign-off on the arc reactor contract before 3pm.", body: "Tony, the board meeting moved to 3pm today. They need your signature on the arc reactor supply contract before then or we lose the deal. Please confirm ASAP.", receivedAt: ago(12), isMock: true },
    { id: `mock-${day}-2`, fromName: "Stripe", fromEmail: "invoices@stripe.com", subject: "Invoice #4821 payment failed", snippet: "We were unable to charge your card ending in 4242 for $2,400.", body: "Your payment of $2,400 for invoice #4821 failed. Please update your payment method within 3 days to avoid service interruption.", receivedAt: ago(45), isMock: true },
    { id: `mock-${day}-3`, fromName: "Happy Hogan", fromEmail: "happy@starkindustries.com", subject: "Car ready at 6", snippet: "Car will be out front at 6pm for the gala.", body: "Boss, car will be ready out front at 6pm for the gala tonight. Let me know if plans change.", receivedAt: ago(90), isMock: true },
    { id: `mock-${day}-4`, fromName: "TechCrunch Daily", fromEmail: "newsletter@techcrunch.com", subject: "Today's top stories in AI", snippet: "Unsubscribe | The 10 biggest AI announcements this week…", body: "Newsletter. The 10 biggest AI announcements this week. Click to read more. Unsubscribe.", receivedAt: ago(130), isMock: true },
    { id: `mock-${day}-5`, fromName: "MegaStore", fromEmail: "deals@megastore.com", subject: "🔥 72-hour flash SALE — 60% off", snippet: "Promotion ends Sunday. Unsubscribe anytime.", body: "Huge promotion! 60% off everything. Sale ends Sunday. Unsubscribe here.", receivedAt: ago(200), isMock: true },
    { id: `mock-${day}-6`, fromName: "Dr. Helen Cho", fromEmail: "h.cho@uhealth.org", subject: "Lab results and follow-up interview slot", snippet: "Your results look good. Could we schedule a short follow-up this week?", body: "Your results look good overall. Could we schedule a 20 minute follow-up interview this week? Thursday or Friday works for me.", receivedAt: ago(260), isMock: true },
  ];
}
