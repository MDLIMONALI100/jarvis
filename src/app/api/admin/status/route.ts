import { appUrl } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getConfig, integrationStatus } from "@/lib/config";
import { handler, json } from "@/lib/http";

export const GET = handler("admin/status", async (req: Request) => {
  const cfg = await getConfig();
  const since = new Date(Date.now() - 86_400_000);
  const [calls, messages, scans, errors, contacts] = await Promise.all([
    prisma.actionLog.count({ where: { type: "CALL_PLACED", createdAt: { gte: since } } }),
    prisma.actionLog.count({ where: { type: "WHATSAPP_SENT", createdAt: { gte: since } } }),
    prisma.actionLog.count({ where: { type: "EMAIL_SCAN", createdAt: { gte: since } } }),
    prisma.actionLog.count({ where: { OR: [{ type: "ERROR" }, { status: "FAILED" }], createdAt: { gte: since } } }),
    prisma.contact.count(),
  ]);
  return json({
    status: integrationStatus(cfg),
    stats24h: { calls, messages, scans, errors },
    contacts,
    cronConfigured: Boolean(process.env.CRON_SECRET),
    appUrl: appUrl(req),
  });
});
