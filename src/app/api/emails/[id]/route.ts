import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";

export const PATCH = handler("emails/patch", async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = z.object({ dismissed: z.boolean().optional(), category: z.enum(["IMPORTANT", "GOOD", "IGNORE"]).optional() }).parse(await req.json());
  return json({ email: await prisma.emailLog.update({ where: { id }, data: body }) });
});
