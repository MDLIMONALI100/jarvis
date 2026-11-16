import "server-only";
import { prisma } from "../db";
import type { ResolvedConfig } from "../config";
import { fetchEvents, googleLive } from "./google";
import { placeCall } from "./voice";
import { logAction } from "./logger";
import { forwardToN8n, n8nTarget } from "./n8n";
import { sendPush } from "./push";
import { meetingMessage, meetingStartMessage } from "./notifications";
import { integrationStatus } from "../config";
import { formatTime, isQuietHours, startOfDayInZone } from "../time";

/** Upsert calendar events into MeetingReminder so auto-call toggles persist. */
async function syncReminders(cfg: ResolvedConfig, from: Date, to: Date) {
  const events = await fetchEvents(cfg, from, to);
  const rows = [];
  for (const e of events) {
    rows.push(
      await prisma.meetingReminder.upsert({
        where: { eventId_startTime: { eventId: e.id, startTime: e.start } },
        update: { title: e.title, endTime: e.end ?? null, location: e.location ?? null, meetLink: e.meetLink ?? null },
        create: {
          eventId: e.id,
          title: e.title,
          startTime: e.start,
          endTime: e.end ?? null,
          location: e.location ?? null,
          meetLink: e.meetLink ?? null,
          autoCall: cfg.autoCallMeetings,
          isMock: Boolean(e.isMock),
        },
      }),
    );
  }
  return rows;
}

/** Today's remaining (and in-progress) meetings for the dashboard. */
export async function upcomingMeetings(cfg: ResolvedConfig) {
  const now = new Date();
  const { end } = startOfDayInZone(now, cfg.timezone);
  const to = new Date(Math.max(end.getTime(), now.getTime() + 6 * 60 * 60_000));
  const rows = await syncReminders(cfg, new Date(now.getTime() - 60 * 60_000), to);
  return rows
    .filter((r) => (r.endTime ?? r.startTime).getTime() > now.getTime())
    .filter((r) => !googleLive(cfg) ? r.isMock : !r.isMock)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Cron: call the owner for meetings starting within [lead, lead + window]
 * minutes. `callTriggered` guarantees at most one call per event instance.
 */
export async function checkMeetings(cfg: ResolvedConfig) {
  const now = new Date();
  const lead = Math.max(1, cfg.callLeadMinutes);
  const windowEnd = new Date(now.getTime() + (lead + Math.max(1, cfg.callWindowMinutes)) * 60_000);
  // Look back a few minutes too, so "starting now" alerts catch just-started meetings.
  const rows = await syncReminders(cfg, new Date(now.getTime() - 5 * 60_000), windowEnd);

  const due = rows.filter((r) => {
    const mins = (r.startTime.getTime() - now.getTime()) / 60_000;
    return r.autoCall && !r.callTriggered && mins > 0 && mins <= lead + Math.max(1, cfg.callWindowMinutes);
  });

  const quiet = isQuietHours(cfg, now);
  const results = [];
  for (const r of due) {
    // Claim the reminder first (atomic) so overlapping cron runs can't double-call.
    const claim = await prisma.meetingReminder.updateMany({
      where: { id: r.id, callTriggered: false },
      data: { callTriggered: true, triggeredAt: now },
    });
    if (claim.count === 0) continue;

    const mins = Math.round((r.startTime.getTime() - now.getTime()) / 60_000);
    const message = `${cfg.ownerName}, you have a meeting titled ${r.title} at ${formatTime(r.startTime, cfg.timezone)}, starting in ${mins} minute${mins === 1 ? "" : "s"}.`;

    if (quiet) {
      await logAction({ type: "CALENDAR_CHECK", status: "SKIPPED", summary: `Quiet hours — no call for "${r.title}"`, detail: { eventId: r.eventId } });
      results.push({ id: r.id, title: r.title, skipped: "quiet-hours" });
      continue;
    }
    if (n8nTarget(cfg, "meetingAlert")) {
      const res = await forwardToN8n(cfg, "meetingAlert", { meeting: r, message, to: cfg.personalPhone });
      await prisma.meetingReminder.update({ where: { id: r.id }, data: { callRef: res.ok ? "n8n" : null, callTriggered: res.ok } });
      results.push({ id: r.id, title: r.title, ok: res.ok, channel: "n8n" });
      continue;
    }
    // Push notification (free) and/or a real phone call when a voice provider is live.
    let pushed = 0;
    if (cfg.pushMeetings) {
      const p = await sendPush(cfg, meetingMessage(cfg, r, mins), `meeting:${r.eventId}`).catch(() => ({ sent: 0 }));
      pushed = p.sent;
    }
    const callLive = integrationStatus(cfg).voice || Boolean(n8nTarget(cfg, "call"));
    let call: { ok: boolean; ref?: string; channel: string; error?: string } | null = null;
    if (callLive || pushed === 0) call = await placeCall(cfg, message, { reason: `meeting:${r.eventId}` });
    const ok = pushed > 0 || Boolean(call?.ok);
    // If nothing reached you, release the claim so the next run retries.
    await prisma.meetingReminder.update({
      where: { id: r.id },
      data: ok ? { callRef: call?.ref ?? (pushed ? "push" : null) } : { callTriggered: false, triggeredAt: null },
    });
    results.push({ id: r.id, title: r.title, ok, pushed, call: call ? { ok: call.ok, channel: call.channel, error: call.error } : null });
  }

  // "Starting now" notifications (from 1 min before to 4 min after the start).
  if (cfg.pushMeetingStart && !quiet) {
    const starting = rows.filter((r) => {
      const m = (r.startTime.getTime() - now.getTime()) / 60_000;
      return r.autoCall && !r.startNotified && m <= 1 && m > -4;
    });
    for (const r of starting) {
      const claim = await prisma.meetingReminder.updateMany({ where: { id: r.id, startNotified: false }, data: { startNotified: true } });
      if (claim.count) await sendPush(cfg, meetingStartMessage(cfg, r), `meeting-start:${r.eventId}`).catch(() => {});
    }
  }

  await logAction({
    type: "CALENDAR_CHECK",
    status: googleLive(cfg) ? "SUCCESS" : "MOCK",
    channel: googleLive(cfg) ? "native" : "mock",
    summary: `${googleLive(cfg) ? "" : "[Demo calendar] "}Checked ${rows.length} event(s) in the next ${lead + cfg.callWindowMinutes} min, ${results.length} reminder(s) processed`,
    detail: { results },
  });
  return { checked: rows.length, reminders: results };
}
