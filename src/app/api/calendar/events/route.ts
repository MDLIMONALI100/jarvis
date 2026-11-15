import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { upcomingMeetings } from "@/lib/services/meetings";

export const GET = handler("calendar/events", async () => json({ meetings: await upcomingMeetings(await getConfig()) }));
