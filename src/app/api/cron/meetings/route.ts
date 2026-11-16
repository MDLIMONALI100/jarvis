import { getConfig } from "@/lib/config";
import { handler, isCronAuthorized, json } from "@/lib/http";
import { checkMeetings } from "@/lib/services/meetings";
import { alertOnIntegrationError, runDailyNotifications } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Run every 5 minutes. Auth: Authorization: Bearer $CRON_SECRET */
const run = handler("cron/meetings", async (req: Request) => {
  if (!isCronAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  const cfg = await getConfig();
  let meetings: unknown;
  try {
    meetings = await checkMeetings(cfg);
  } catch (e) {
    await alertOnIntegrationError(cfg, e).catch(() => {});
    throw e;
  }
  const daily = await runDailyNotifications(cfg);
  return json({ meetings, daily });
});
export { run as GET, run as POST };
