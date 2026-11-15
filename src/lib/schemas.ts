import { z } from "zod";
import { normalizePhone } from "./utils";

export const ContactInput = z.object({
  name: z.string().trim().min(1).max(100),
  nicknames: z.string().max(500).default(""),
  phone: z.string().trim().min(6).max(40).transform(normalizePhone).refine((p) => p.length >= 8, "Invalid phone number"),
  email: z.string().email().or(z.literal("")).nullable().optional().transform((v) => v || null),
  notes: z.string().max(1000).nullable().optional(),
  isVip: z.boolean().default(false),
});
