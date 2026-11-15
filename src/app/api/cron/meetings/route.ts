import { getConfig } from "@/lib/config";
import { handler, isCronAuthorized, json } from "@/lib/http";
import { checkMeetings } from "@/lib/services/meetings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Run every 5 minutes. Auth: Authorization: Bearer $CRON_SECRET */
const run = handler("cron/meetings", async (req: Request) => {
  if (!isCronAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  return json(await checkMeetings(await getConfig()));
});
export { run as GET, run as POST };
