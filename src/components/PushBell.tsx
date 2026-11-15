"use client";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { enablePush, getPushState, type PushState } from "@/lib/push-client";
import { cn } from "@/lib/utils";

const HINT: Record<PushState, string> = {
  on: "Alerts are on for this device",
  off: "Turn on phone alerts",
  denied: "Notifications are blocked: allow them in your browser/phone settings for this site",
  "needs-install": "On iPhone: tap Share → Add to Home Screen, open J.A.R.V.I.S. from the home screen, then tap the bell",
  unsupported: "This browser doesn't support push notifications",
};

/** Header bell: one tap to enable push alerts on this device. */
export function PushBell({ onMessage }: { onMessage?: (text: string) => void }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const click = async () => {
    if (state === "on") return onMessage?.(HINT.on);
    if (state !== "off") return onMessage?.(HINT[state ?? "unsupported"]);
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      onMessage?.(s === "on" ? "Alerts enabled. I'll notify you before meetings and about urgent emails." : HINT[s]);
    } catch (e) {
      onMessage?.(`Couldn't enable alerts: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const Icon = busy ? Loader2 : state === "on" ? BellRing : state === "off" || state === null ? Bell : BellOff;
  return (
    <button
      className={cn("hud-btn relative h-9 w-9 p-0", state === "on" && "border-emerald-400/50 text-emerald-200")}
      onClick={click}
      aria-label={HINT[state ?? "off"]}
      title={HINT[state ?? "off"]}
    >
      <Icon className={cn("h-4 w-4", busy && "animate-spin")} />
      {state === "off" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />}
    </button>
  );
}
