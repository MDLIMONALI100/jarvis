import { prisma } from "@/lib/db";
import { getConfig, integrationStatus } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { priorityEmails } from "@/lib/services/email-triage";
import { upcomingMeetings } from "@/lib/services/meetings";

/** Everything the HUD needs in one round trip. */
export const GET = handler("dashboard", async () => {
  const cfg = await getConfig();
  if ((await prisma.emailLog.count()) === 0) {
    // First load: populate the priority feed (demo inbox if Gmail isn't connected).
    const { syncEmails } = await import("@/lib/services/email-triage");
    await syncEmails(cfg, { alert: false }).catch(() => {});
  }
  const [emails, meetings, messages, activity] = await Promise.all([
    priorityEmails(15),
    upcomingMeetings(cfg).catch(() => []),
    prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { contact: { select: { name: true } } } }),
    prisma.actionLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return json({
    owner: cfg.ownerName,
    assistant: cfg.assistantName,
    timezone: cfg.timezone,
    callLeadMinutes: cfg.callLeadMinutes,
    voice: { name: cfg.voiceName, rate: cfg.voiceRate, pitch: cfg.voicePitch, lang: cfg.voiceLang, speak: cfg.speakResponses },
    status: integrationStatus(cfg),
    emails,
    meetings,
    messages,
    activity,
  });
});
