import { getConfig } from "@/lib/config";
import { handler, isCronAuthorized, json } from "@/lib/http";
import { syncEmails } from "@/lib/services/email-triage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Run every 10-15 minutes. Auth: Authorization: Bearer $CRON_SECRET */
const run = handler("cron/emails", async (req: Request) => {
  if (!isCronAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  return json(await syncEmails(await getConfig()));
});
export { run as GET, run as POST };
