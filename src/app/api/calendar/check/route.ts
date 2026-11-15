import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { checkMeetings } from "@/lib/services/meetings";

export const POST = handler("calendar/check", async () => json(await checkMeetings(await getConfig())));
