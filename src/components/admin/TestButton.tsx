"use client";
import { CheckCircle2, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client";

export function TestButton({ type, label, icon: Icon, to, disabled }: { type: "call" | "whatsapp" | "llm" | "google" | "n8n" | "push"; label: string; icon: LucideIcon; to?: string; disabled?: boolean }) {
  const [state, setState] = useState<{ loading: boolean; ok?: boolean; msg?: string }>({ loading: false });
  const run = async () => {
    setState({ loading: true });
    try {
      const r =
        type === "push"
          ? await api<{ ok: boolean; message: string }>("/api/push/test", { method: "POST", json: {} })
          : await api<{ ok: boolean; message: string }>("/api/admin/test", { method: "POST", json: { type, to: to || undefined } });
      setState({ loading: false, ok: r.ok, msg: r.message });
    } catch (e) {
      setState({ loading: false, ok: false, msg: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="space-y-1.5">
      <button type="button" className="hud-btn w-full" onClick={run} disabled={state.loading || disabled}>
        {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
      </button>
      {state.msg && (
        <p className={`flex items-start gap-1.5 text-[11px] ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {state.ok ? <CheckCircle2 className="mt-px h-3 w-3 shrink-0" /> : <XCircle className="mt-px h-3 w-3 shrink-0" />}
          {state.msg}
        </p>
      )}
    </div>
  );
}
