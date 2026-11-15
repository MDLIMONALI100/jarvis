import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";

/** Toggle the per-meeting "Auto-Call Reminder". */
export const PATCH = handler("calendar/toggle", async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { autoCall } = z.object({ autoCall: z.boolean() }).parse(await req.json());
  return json({ meeting: await prisma.meetingReminder.update({ where: { id }, data: { autoCall } }) });
});
