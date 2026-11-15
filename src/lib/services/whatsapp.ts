import "server-only";
import { prisma } from "../db";
import type { ResolvedConfig } from "../config";
import type { ServiceResult } from "../types";
import { normalizePhone } from "../utils";
import { forwardToN8n, n8nTarget } from "./n8n";
import { logAction } from "./logger";

async function sendViaCloud(cfg: ResolvedConfig, to: string, body: string): Promise<ServiceResult> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.whatsappPhoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: true, body },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) return { ok: false, channel: "native", error: `WhatsApp ${res.status}: ${data.error?.message ?? "unknown error"}` };
  return { ok: true, channel: "native", ref: data.messages?.[0]?.id, detail: { provider: "cloud" } };
}

async function sendViaTwilio(cfg: ResolvedConfig, to: string, body: string): Promise<ServiceResult> {
  const from = cfg.twilioWhatsappFrom!.startsWith("whatsapp:") ? cfg.twilioWhatsappFrom! : `whatsapp:${cfg.twilioWhatsappFrom}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: body }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) return { ok: false, channel: "native", error: `Twilio ${res.status}: ${data.message ?? "unknown error"}` };
  return { ok: true, channel: "native", ref: data.sid, detail: { provider: "twilio" } };
}

/**
 * Send a WhatsApp text. Note: the Cloud API only delivers free-form text inside
 * the 24h customer-service window; outside it you must use an approved template.
 */
export async function sendWhatsApp(
  cfg: ResolvedConfig,
  rawTo: string,
  body: string,
  opts: { contactId?: string; contactName?: string; reason?: string } = {},
): Promise<ServiceResult & { messageId?: string }> {
  const to = normalizePhone(rawTo);
  if (to.length < 8) return { ok: false, channel: "native", error: `Invalid phone number "${rawTo}"` };

  let result: ServiceResult;
  if (n8nTarget(cfg, "whatsapp")) {
    result = await forwardToN8n(cfg, "whatsapp", { to, body, contactName: opts.contactName, reason: opts.reason });
  } else if (cfg.whatsappProvider === "cloud" && cfg.whatsappToken && cfg.whatsappPhoneId) {
    result = await sendViaCloud(cfg, to, body).catch((e) => ({ ok: false, channel: "native" as const, error: String(e) }));
  } else if (cfg.whatsappProvider === "twilio" && cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioWhatsappFrom) {
    result = await sendViaTwilio(cfg, to, body).catch((e) => ({ ok: false, channel: "native" as const, error: String(e) }));
  } else {
    result = { ok: true, channel: "mock", ref: `mock-wa-${Date.now()}`, detail: { note: "WhatsApp provider not configured — simulated send." } };
  }

  const msg = await prisma.whatsAppMessage.create({
    data: {
      direction: "OUTBOUND",
      phone: to,
      body,
      status: !result.ok ? "FAILED" : result.channel === "mock" ? "MOCK" : "SENT",
      providerId: result.ref ?? null,
      error: result.error ?? null,
      contactId: opts.contactId ?? null,
    },
  });
  await logAction({
    type: "WHATSAPP_SENT",
    status: !result.ok ? "FAILED" : result.channel === "mock" ? "MOCK" : "SUCCESS",
    channel: result.channel,
    summary: `${result.channel === "mock" ? "[Simulated] " : ""}WhatsApp to ${opts.contactName ? `${opts.contactName} (${to})` : to}: "${body.slice(0, 120)}"`,
    detail: { to, body, reason: opts.reason, ref: result.ref },
    error: result.error,
  });
  return { ...result, messageId: msg.id };
}
