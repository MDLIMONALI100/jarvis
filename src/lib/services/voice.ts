import "server-only";
import type { ResolvedConfig } from "../config";
import type { ServiceResult } from "../types";
import { forwardToN8n, n8nTarget } from "./n8n";
import { logAction } from "./logger";

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

async function callViaVapi(cfg: ResolvedConfig, to: string, message: string): Promise<ServiceResult> {
  const body: Record<string, unknown> = {
    phoneNumberId: cfg.vapiPhoneNumberId,
    customer: { number: to },
  };
  if (cfg.vapiAssistantId) {
    body.assistantId = cfg.vapiAssistantId;
    // Override the greeting so the assistant opens with this alert.
    body.assistantOverrides = { firstMessage: message, variableValues: { alert: message } };
  } else {
    // Transient assistant: speaks the alert, can answer follow-ups briefly, then ends.
    body.assistant = {
      name: cfg.assistantName.replace(/\./g, ""),
      firstMessage: message,
      model: {
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are ${cfg.assistantName}, a polite British AI butler calling ${cfg.ownerName}. You just delivered this alert: "${message}". Answer brief follow-up questions about it, then say goodbye and end the call.`,
          },
        ],
      },
      voice: { provider: "11labs", voiceId: "burt" },
      endCallPhrases: ["goodbye", "thank you jarvis", "that's all"],
      maxDurationSeconds: 120,
    };
  }
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.vapiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: unknown };
  if (!res.ok) return { ok: false, channel: "native", error: `Vapi ${res.status}: ${JSON.stringify(data.message ?? data).slice(0, 300)}` };
  return { ok: true, channel: "native", ref: data.id, detail: { provider: "vapi" } };
}

async function callViaTwilio(cfg: ResolvedConfig, to: string, message: string): Promise<ServiceResult> {
  const twiml = `<Response><Pause length="1"/><Say voice="${escapeXml(cfg.twilioVoice || "Polly.Brian")}">${escapeXml(message)}</Say><Pause length="1"/><Say voice="${escapeXml(cfg.twilioVoice || "Polly.Brian")}">${escapeXml(message)}</Say></Response>`;
  const form = new URLSearchParams({ To: to, From: cfg.twilioFromNumber!, Twiml: twiml });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) return { ok: false, channel: "native", error: `Twilio ${res.status}: ${data.message ?? "unknown error"}` };
  return { ok: true, channel: "native", ref: data.sid, detail: { provider: "twilio" } };
}

/**
 * Place an outbound call that speaks `message`. Routes to n8n when the bridge
 * is enabled for "call", otherwise Vapi / Twilio, otherwise a logged mock.
 */
export async function placeCall(cfg: ResolvedConfig, message: string, opts: { to?: string; reason?: string } = {}): Promise<ServiceResult> {
  const to = opts.to || cfg.personalPhone;
  if (!to) {
    const r: ServiceResult = { ok: false, channel: "native", error: "No personal phone number configured (Admin → Calls & Alerts)." };
    await logAction({ type: "CALL_PLACED", status: "FAILED", summary: `Call not placed: ${opts.reason ?? "manual"}`, error: r.error });
    return r;
  }

  let result: ServiceResult;
  if (n8nTarget(cfg, "call")) {
    result = await forwardToN8n(cfg, "call", { to, message, reason: opts.reason });
  } else if (cfg.voiceProvider === "vapi" && cfg.vapiApiKey && cfg.vapiPhoneNumberId) {
    result = await callViaVapi(cfg, to, message).catch((e) => ({ ok: false, channel: "native" as const, error: String(e) }));
  } else if (cfg.voiceProvider === "twilio" && cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFromNumber) {
    result = await callViaTwilio(cfg, to, message).catch((e) => ({ ok: false, channel: "native" as const, error: String(e) }));
  } else {
    result = { ok: true, channel: "mock", ref: `mock-call-${Date.now()}`, detail: { note: "Voice provider not configured — simulated call." } };
  }

  await logAction({
    type: "CALL_PLACED",
    status: !result.ok ? "FAILED" : result.channel === "mock" ? "MOCK" : "SUCCESS",
    channel: result.channel,
    summary: `${result.channel === "mock" ? "[Simulated] " : ""}Call to ${to}: "${message.slice(0, 120)}"`,
    detail: { to, message, reason: opts.reason, ref: result.ref, ...((result.detail as object) ?? {}) },
    error: result.error,
  });
  return result;
}
