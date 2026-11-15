import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { ContactInput } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler("contacts:update", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const data = ContactInput.partial().parse(await req.json());
  return json({ contact: await prisma.contact.update({ where: { id }, data }) });
});

export const DELETE = handler("contacts:delete", async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await prisma.contact.delete({ where: { id } });
  return json({ ok: true });
});
