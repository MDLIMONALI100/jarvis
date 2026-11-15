"use client";
import { BellRing, Loader2, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push-client";
import { Badge, Section, Toggle } from "./ui";
import { TestButton } from "./TestButton";
import type { AdminCtx } from "./types";

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
      <Toggle checked={get<boolean>("pushMeetings")} onChange={(v) => set("pushMeetings", v)} label="Meeting reminders" hint="Notify before each meeting (uses the lead time below)" />
      <Toggle checked={get<boolean>("pushUrgentEmails")} onChange={(v) => set("pushUrgentEmails", v)} label="Urgent emails" hint="Notify when an email scores at or above the urgency threshold" />
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
