import "server-only";
import { prisma } from "../db";
import type { ResolvedConfig } from "../config";
import { formatTime, minutesInZone, startOfDayInZone } from "../time";
import { sendPush, type PushMessage } from "./push";
import { logAction } from "./logger";

/** Every notification type Jarvis can send (used for settings and previews). */
export const NOTIFICATION_TYPES = ["briefing", "meeting", "meetingStart", "urgentEmail", "digest", "whatsapp", "system"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** YYYY-MM-DD in the user's timezone. */
function localDate(tz: string, d = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

const hm = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// ── Message builders (shared by real sends and previews) ────────────────────

export function meetingMessage(cfg: ResolvedConfig, m: { id: string; title: string; startTime: Date; location?: string | null; meetLink?: string | null }, mins: number): PushMessage {
  return {
    title: `📅 ${clip(m.title, 60)} in ${mins} min`,
    body: `${formatTime(m.startTime, cfg.timezone)}${m.location ? ` · ${m.location}` : ""}${m.meetLink ? " · tap to join" : ""}`,
    url: m.meetLink || "/",
    tag: `meeting-${m.id}`,
    urgent: true,
  };
}

export function meetingStartMessage(cfg: ResolvedConfig, m: { id: string; title: string; startTime: Date; meetLink?: string | null }): PushMessage {
  return {
    title: `⏰ Starting now: ${clip(m.title, 60)}`,
    body: m.meetLink ? "Tap to join the call." : `Scheduled for ${formatTime(m.startTime, cfg.timezone)}.`,
    url: m.meetLink || "/",
    tag: `meeting-${m.id}`,
    urgent: true,
  };
}

export function urgentEmailMessage(e: { id: string; fromName: string; subject: string; summary: string }): PushMessage {
  return { title: clip(`🚨 ${e.fromName}: ${e.subject}`, 110), body: clip(e.summary, 220), url: "/", tag: `email-${e.id}`, urgent: true };
}

async function briefingMessage(cfg: ResolvedConfig): Promise<PushMessage> {
  const now = new Date();
  const { start, end } = startOfDayInZone(now, cfg.timezone);
  const [meetings, emails] = await Promise.all([
    prisma.meetingReminder.findMany({ where: { startTime: { gte: now, lt: end }, isMock: false }, orderBy: { startTime: "asc" }, take: 4 }),
    prisma.emailLog.findMany({ where: { category: { in: ["IMPORTANT", "GOOD"] }, dismissed: false, receivedAt: { gte: new Date(start.getTime() - 12 * 3600_000) } }, orderBy: { score: "desc" }, take: 3 }),
  ]);
  const hour = Math.floor(minutesInZone(now, cfg.timezone) / 60);
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const parts = [
    meetings.length
      ? `${meetings.length} meeting${meetings.length > 1 ? "s" : ""}: ${meetings.map((m) => `${clip(m.title, 28)} ${formatTime(m.startTime, cfg.timezone)}`).join(", ")}.`
      : "No meetings today.",
    emails.length ? `${emails.length} email${emails.length > 1 ? "s" : ""} worth reading, top: ${clip(emails[0].fromName, 24)}.` : "Inbox is quiet.",
  ];
  return { title: `🌅 ${greet}, ${cfg.ownerName}`, body: clip(parts.join(" "), 230), url: "/?action=briefing", tag: "briefing" };
}

async function digestMessage(): Promise<PushMessage | null> {
  const emails = await prisma.emailLog.findMany({
    where: { category: { in: ["IMPORTANT", "GOOD"] }, dismissed: false, receivedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { score: "desc" },
    take: 5,
  });
  if (!emails.length) return null;
  return {
    title: `📬 ${emails.length} email${emails.length > 1 ? "s" : ""} worth reading today`,
    body: clip(emails.map((e) => `${clip(e.fromName, 20)}: ${clip(e.subject, 40)}`).join(" · "), 230),
    url: "/",
    tag: "digest",
  };
}

export function whatsappMessage(from: string, body: string): PushMessage {
  return { title: `💬 ${clip(from, 40)}`, body: clip(body, 220), url: "/", tag: `wa-${from.replace(/\W/g, "").slice(-12)}` };
}

// ── Scheduled (called every 5 minutes by the meetings cron) ─────────────────

/** Morning briefing and evening digest, each at most once per local day. */
export async function runDailyNotifications(cfg: ResolvedConfig) {
  const now = new Date();
  const today = localDate(cfg.timezone, now);
  const mins = minutesInZone(now, cfg.timezone);
  const sent: string[] = [];

  // Fire within 2 hours after the chosen time (covers missed cron runs), not later.
  const due = (time: string, last: string) => last !== today && mins >= hm(time) && mins < hm(time) + 120;

  if (cfg.pushBriefing && due(cfg.briefingTime, cfg.lastBriefingDate)) {
    const claim = await prisma.userConfig.updateMany({ where: { id: "singleton", lastBriefingDate: { not: today } }, data: { lastBriefingDate: today } });
    if (claim.count) {
      await sendPush(cfg, await briefingMessage(cfg), "briefing");
      sent.push("briefing");
    }
  }
  if (cfg.pushDigest && due(cfg.digestTime, cfg.lastDigestDate)) {
    const claim = await prisma.userConfig.updateMany({ where: { id: "singleton", lastDigestDate: { not: today } }, data: { lastDigestDate: today } });
    if (claim.count) {
      const msg = await digestMessage();
      if (msg) {
        await sendPush(cfg, msg, "digest");
        sent.push("digest");
      }
    }
  }
  return sent;
}

/** A problem that needs the owner's attention (at most one per day). */
export async function systemAlert(cfg: ResolvedConfig, problem: string, fix: string) {
  if (!cfg.pushSystem) return;
  const today = localDate(cfg.timezone);
  const claim = await prisma.userConfig.updateMany({ where: { id: "singleton", lastSystemAlert: { not: today } }, data: { lastSystemAlert: today } });
  if (!claim.count) return;
  await sendPush(cfg, { title: `⚠️ ${clip(problem, 80)}`, body: clip(fix, 200), url: "/admin?tab=integrations", tag: "system" }, "system");
}

/** Turns an integration error into a plain-language system alert, if it is one. */
export async function alertOnIntegrationError(cfg: ResolvedConfig, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Google auth failed|invalid_grant|Google API 40[13]/i.test(msg)) {
    await systemAlert(cfg, "Google disconnected", "Jarvis can't read your email or calendar. Open Admin → API & Webhooks → Connect Google.");
  } else if (/Google API|Google/i.test(msg)) {
    await systemAlert(cfg, "Google error", clip(msg, 180));
  }
}

// ── Previews ─────────────────────────────────────────────────────────────────

export async function sendPreview(cfg: ResolvedConfig, type: NotificationType | "all") {
  const soon = new Date(Date.now() + 10 * 60_000);
  const demoMeeting = { id: "preview", title: "Design review with the team", startTime: soon, location: "Room A", meetLink: "https://meet.google.com/" };
  const build: Record<NotificationType, () => Promise<PushMessage> | PushMessage> = {
    briefing: () => briefingMessage(cfg),
    meeting: () => meetingMessage(cfg, demoMeeting, 10),
    meetingStart: () => meetingStartMessage(cfg, { ...demoMeeting, startTime: new Date() }),
    urgentEmail: () => urgentEmailMessage({ id: "preview", fromName: "Your Boss", subject: "Contract must be signed today", summary: "The client needs your signature before 5 PM or the deal is delayed." }),
    digest: async () =>
      (await digestMessage()) ?? { title: "📬 3 emails worth reading today", body: "Bank: Statement ready · Dr. Rahman: Follow-up slot · GitHub: PR approved", url: "/", tag: "digest" },
    whatsapp: () => whatsappMessage("Mom", "Are you coming home for dinner tonight?"),
    system: () => ({ title: "⚠️ Google disconnected", body: "Jarvis can't read your email or calendar. Open Admin → API & Webhooks → Connect Google.", url: "/admin?tab=integrations", tag: "system" }),
  };
  const types = type === "all" ? NOTIFICATION_TYPES : [type];
  let sent = 0;
  let devices = 0;
  for (const t of types) {
    const msg = await build[t]();
    // Distinct tags so previews don't replace each other on the lock screen.
    const r = await sendPush(cfg, { ...msg, tag: `preview-${t}` }, `preview:${t}`);
    sent += r.sent;
    devices = r.devices;
  }
  await logAction({ type: "PUSH_SENT", status: sent ? "SUCCESS" : "FAILED", summary: `Previewed ${types.length} notification type(s)` });
  return { sent, devices, types: types.length };
}
