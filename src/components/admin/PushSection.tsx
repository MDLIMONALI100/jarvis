"use client";
import { BellRing, Loader2, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push-client";
import { Badge, Section } from "./ui";
import { TestButton } from "./TestButton";
import type { AdminCtx } from "./types";

const TYPES: { key: string; preview: string; emoji: string; label: string; hint: string; time?: string }[] = [
  { key: "pushBriefing", preview: "briefing", emoji: "🌅", label: "Morning briefing", hint: "Today's meetings and top emails", time: "briefingTime" },
  { key: "pushMeetings", preview: "meeting", emoji: "📅", label: "Meeting reminder", hint: "Before each meeting (lead time below)" },
  { key: "pushMeetingStart", preview: "meetingStart", emoji: "⏰", label: "Meeting starting now", hint: "At start time, tap to join" },
  { key: "pushUrgentEmails", preview: "urgentEmail", emoji: "🚨", label: "Urgent email", hint: "Emails at or above the urgency threshold" },
  { key: "pushDigest", preview: "digest", emoji: "📬", label: "Evening email digest", hint: "Emails worth reading today", time: "digestTime" },
  { key: "pushWhatsApp", preview: "whatsapp", emoji: "💬", label: "New WhatsApp message", hint: "When someone messages your WhatsApp number" },
  { key: "pushSystem", preview: "system", emoji: "⚠️", label: "System alerts", hint: "Google disconnected or other problems (max 1/day)" },
];

function PreviewButton({ type, label, disabled }: { type: string; label: string; disabled?: boolean }) {
  const [st, setSt] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const run = async () => {
    setSt("busy");
    try {
      const r = await api<{ ok: boolean }>("/api/push/test", { method: "POST", json: { type } });
      setSt(r.ok ? "ok" : "err");
    } catch {
      setSt("err");
    }
    setTimeout(() => setSt("idle"), 2500);
  };
  return (
    <button type="button" className="hud-btn px-2 py-1 text-[11px]" onClick={run} disabled={disabled || st === "busy"} title={disabled ? "Enable notifications on a device first" : "Send this notification to your devices"}>
      {st === "busy" ? <Loader2 className="h-3 w-3 animate-spin" /> : st === "ok" ? "Sent ✓" : st === "err" ? "Failed" : label}
    </button>
  );
}

interface Device {
  id: string;
  label: string;
  createdAt: string;
  lastSuccessAt: string | null;
}

const STATE_TEXT: Record<PushState, string> = {
  on: "Enabled on this device",
  off: "Not enabled on this device",
  denied: "Blocked: allow notifications for this site in your browser or phone settings, then reload.",
  "needs-install": "iPhone/iPad: tap Share → Add to Home Screen, open J.A.R.V.I.S. from the home screen, then enable here (iOS 16.4+).",
  unsupported: "This browser doesn't support push notifications.",
};

export function PushSection({ ctx }: { ctx: AdminCtx }) {
  const { get, set } = ctx;
  const [state, setState] = useState<PushState | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState(await getPushState().catch(() => "unsupported" as const));
    const r = await api<{ devices: Device[] }>("/api/push").catch(() => ({ devices: [] }));
    setDevices(r.devices);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggleThisDevice = async () => {
    setBusy(true);
    setError(null);
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await api("/api/push", { method: "DELETE", json: { id } });
    load();
  };

  return (
    <Section
      title="Push Notifications"
      description="Free, unlimited alerts that buzz your phone, with no phone or SMS service needed."
      actions={<Badge on={devices.length > 0}>{devices.length ? `${devices.length} device${devices.length > 1 ? "s" : ""}` : "Off"}</Badge>}
    >
      <div className="space-y-2 sm:col-span-2">
        <p className="text-sm text-slate-200">{state ? STATE_TEXT[state] : "Checking…"}</p>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <button className={`hud-btn ${state === "on" ? "" : "hud-btn-primary"}`} onClick={toggleThisDevice} disabled={busy || state === null || state === "unsupported" || state === "needs-install" || state === "denied"}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            {state === "on" ? "Turn off on this device" : "Enable on this device"}
          </button>
          <TestButton type="push" label="Send test notification" icon={Smartphone} disabled={devices.length === 0} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="hud-label">Notification types</p>
          <PreviewButton type="all" label="Preview all" disabled={devices.length === 0} />
        </div>
        <ul className="divide-y divide-hud-line/60 rounded-lg border border-hud-line bg-black/20">
          {TYPES.map((t) => (
            <li key={t.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="text-lg" aria-hidden>{t.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-[11px] text-hud-dim">{t.hint}</p>
              </div>
              {t.time && (
                <input
                  type="time"
                  value={get<string>(t.time)}
                  onChange={(e) => set(t.time!, e.target.value)}
                  className="hud-input w-[110px] py-1.5"
                  aria-label={`${t.label} time`}
                />
              )}
              <PreviewButton type={t.preview} label="Preview" disabled={devices.length === 0} />
              <button
                type="button"
                role="switch"
                aria-checked={get<boolean>(t.key)}
                aria-label={t.label}
                onClick={() => set(t.key, !get<boolean>(t.key))}
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${get<boolean>(t.key) ? "border-cyan-400/70 bg-cyan-500/30" : "border-slate-600 bg-slate-800"}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${get<boolean>(t.key) ? "left-[22px] bg-cyan-200" : "left-0.5 bg-slate-400"}`} />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-hud-dim">Times use your timezone ({get<string>("timezone")}). Save after changing switches or times.</p>
      </div>
      {devices.length > 0 && (
        <ul className="space-y-1.5 sm:col-span-2">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-hud-line bg-black/20 px-3 py-2 text-sm">
              <Smartphone className="h-4 w-4 shrink-0 text-cyan-300" />
              <span className="min-w-0 flex-1 truncate">{d.label || "Device"}</span>
              <span className="shrink-0 font-mono text-[10px] text-hud-dim">
                {d.lastSuccessAt ? `last alert ${timeAgo(d.lastSuccessAt)}` : `added ${timeAgo(d.createdAt)}`}
              </span>
              <button className="rounded p-1 text-hud-dim hover:text-rose-300" onClick={() => remove(d.id)} aria-label={`Remove ${d.label}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
