import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { ContactInput } from "@/lib/schemas";

export const GET = handler("contacts", async () => json({ contacts: await prisma.contact.findMany({ orderBy: { name: "asc" } }) }));

export const POST = handler("contacts:create", async (req: Request) => {
  const data = ContactInput.parse(await req.json());
  return json({ contact: await prisma.contact.create({ data }) }, 201);
});
