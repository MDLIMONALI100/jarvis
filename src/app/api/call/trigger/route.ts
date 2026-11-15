import { z } from "zod";
import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { placeCall } from "@/lib/services/voice";

export const POST = handler("call/trigger", async (req: Request) => {
  const body = z
    .object({ message: z.string().trim().max(1000).optional(), to: z.string().max(40).optional() })
    .parse(await req.json().catch(() => ({})));
  const cfg = await getConfig();
  const message = body.message || `Hello ${cfg.ownerName}, this is ${cfg.assistantName}. You asked me to call. How may I help?`;
  // Only allow calling a number other than your own via automation token or session — both already authenticated.
  const result = await placeCall(cfg, message, { to: body.to, reason: "manual" });
  return json(result, result.ok ? 200 : 502);
});
