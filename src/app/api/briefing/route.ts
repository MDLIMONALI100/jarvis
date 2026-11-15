import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { dailyBriefing } from "@/lib/services/briefing";
import { logAction } from "@/lib/services/logger";

export const GET = handler("briefing", async () => {
  const b = await dailyBriefing(await getConfig());
  await logAction({ type: "COMMAND", status: "SUCCESS", summary: "Daily briefing generated" });
  return json(b);
});
