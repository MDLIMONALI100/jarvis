import { getConfig } from "@/lib/config";
import { handler, isCronAuthorized, json } from "@/lib/http";
import { syncEmails } from "@/lib/services/email-triage";
import { alertOnIntegrationError } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Run every 10-15 minutes. Auth: Authorization: Bearer $CRON_SECRET */
const run = handler("cron/emails", async (req: Request) => {
  if (!isCronAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  const cfg = await getConfig();
  try {
    return json(await syncEmails(cfg));
  } catch (e) {
    await alertOnIntegrationError(cfg, e).catch(() => {});
    throw e;
  }
});
export { run as GET, run as POST };
