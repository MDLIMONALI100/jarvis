import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { logAction } from "@/lib/services/logger";
import { appUrl, normalizePhone } from "@/lib/utils";
import { sendPush } from "@/lib/services/push";
import { whatsappMessage } from "@/lib/services/notifications";

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const cfg = await getConfig();
  if (p.get("hub.mode") === "subscribe" && cfg.whatsappVerifyToken && p.get("hub.verify_token") === cfg.whatsappVerifyToken) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

interface MetaPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: { from: string; id: string; type: string; text?: { body: string } }[];
        statuses?: { id: string; status: string; errors?: { title?: string }[] }[];
      };
    }[];
  }[];
}

/**
 * Inbound messages + delivery statuses.
 * Accepts Meta Cloud API JSON (verified via X-Hub-Signature-256 when an App
 * Secret is configured) and Twilio form posts (verified via X-Twilio-Signature).
 */
export async function POST(req: Request) {
  const cfg = await getConfig();
  const raw = await req.text();
  const ctype = req.headers.get("content-type") ?? "";

  if (ctype.includes("application/x-www-form-urlencoded")) {
    // Twilio
    const params = new URLSearchParams(raw);
    if (cfg.twilioAuthToken) {
      const url = `${appUrl(req)}/api/whatsapp/webhook`;
      const data = [...params.keys()].sort().reduce((acc, k) => acc + k + params.get(k), url);
      const expected = createHmac("sha1", cfg.twilioAuthToken).update(data).digest("base64");
      const got = req.headers.get("x-twilio-signature") ?? "";
      if (expected.length !== got.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(got))) {
        return new Response("Invalid signature", { status: 403 });
      }
    }
    const status = params.get("MessageStatus");
    const sid = params.get("MessageSid");
    if (status && sid && !params.get("Body")) {
      await prisma.whatsAppMessage.updateMany({ where: { providerId: sid }, data: { status: status.toUpperCase() } });
    } else if (params.get("Body")) {
      await recordInbound(normalizePhone((params.get("From") ?? "").replace("whatsapp:", "")), params.get("Body")!, sid);
    }
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }

  // Meta
  if (cfg.whatsappAppSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", cfg.whatsappAppSecret).update(raw).digest("hex")}`;
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return new Response("Invalid signature", { status: 403 });
    }
  }
  let body: MetaPayload = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        await prisma.whatsAppMessage.updateMany({
          where: { providerId: s.id },
          data: { status: s.status.toUpperCase(), error: s.errors?.[0]?.title ?? undefined },
        });
      }
      for (const m of change.value?.messages ?? []) {
        await recordInbound(normalizePhone(m.from), m.text?.body ?? `[${m.type} message]`, m.id);
      }
    }
  }
  return new Response("OK");
}

async function recordInbound(phone: string, body: string, providerId?: string | null) {
  const contact = await prisma.contact.findFirst({ where: { phone } });
  await prisma.whatsAppMessage.create({
    data: { direction: "INBOUND", phone, body, status: "RECEIVED", providerId: providerId ?? null, contactId: contact?.id ?? null },
  });
  await logAction({
    type: "WHATSAPP_RECEIVED",
    status: "SUCCESS",
    summary: `WhatsApp from ${contact?.name ?? phone}: "${body.slice(0, 120)}"`,
    detail: { phone, providerId },
  });
  const cfg = await getConfig();
  if (cfg.pushWhatsApp) await sendPush(cfg, whatsappMessage(contact?.name ?? phone, body), "whatsapp-inbound").catch(() => {});
}
