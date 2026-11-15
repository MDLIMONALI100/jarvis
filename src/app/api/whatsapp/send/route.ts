import { z } from "zod";
import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { resolveContact } from "@/lib/services/contacts";
import { sendWhatsApp } from "@/lib/services/whatsapp";

const Body = z
  .object({ to: z.string().max(40).optional(), contact: z.string().max(100).optional(), message: z.string().trim().min(1).max(4096) })
  .refine((b) => b.to || b.contact, "Provide `to` (phone) or `contact` (name)");

export const POST = handler("whatsapp/send", async (req: Request) => {
  const body = Body.parse(await req.json());
  const cfg = await getConfig();
  let to = body.to;
  let contactId: string | undefined;
  let contactName: string | undefined;
  if (!to && body.contact) {
    const { contact, candidates } = await resolveContact(body.contact);
    if (!contact) return json({ error: `Unknown contact "${body.contact}"`, candidates: candidates.map((c) => c.name) }, 404);
    to = contact.phone;
    contactId = contact.id;
    contactName = contact.name;
  }
  const result = await sendWhatsApp(cfg, to!, body.message, { contactId, contactName, reason: "api" });
  return json(result, result.ok ? 200 : 502);
});
