import "server-only";
import type { ResolvedConfig } from "../config";
import type { N8nAction, ServiceResult } from "../types";

/** Returns the webhook URL if the n8n bridge is on and this action has one. */
export function n8nTarget(cfg: ResolvedConfig, action: N8nAction): string | null {
  if (!cfg.n8nEnabled) return null;
  const url = cfg.n8nWebhooks[action];
  return url && /^https?:\/\//.test(url) ? url : null;
}

/** POST the action payload to n8n. n8n then performs the real side-effect. */
export async function forwardToN8n(cfg: ResolvedConfig, action: N8nAction, payload: Record<string, unknown>): Promise<ServiceResult> {
  const url = n8nTarget(cfg, action);
  if (!url) return { ok: false, channel: "n8n", error: `No n8n webhook configured for "${action}"` };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.n8nSecret ? { "X-Jarvis-Secret": cfg.n8nSecret } : {}),
      },
      body: JSON.stringify({ action, source: "jarvis", timestamp: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, channel: "n8n", error: `n8n responded ${res.status}: ${text.slice(0, 300)}` };
    let detail: unknown = text;
    try {
      detail = JSON.parse(text);
    } catch {}
    return { ok: true, channel: "n8n", detail };
  } catch (e) {
    return { ok: false, channel: "n8n", error: e instanceof Error ? e.message : String(e) };
  }
}
