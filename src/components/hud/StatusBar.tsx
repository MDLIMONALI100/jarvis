import { cn } from "@/lib/utils";
import type { Dashboard } from "./types";

const ITEMS: { key: keyof Dashboard["status"]; label: string }[] = [
  { key: "llm", label: "AI" },
  { key: "voice", label: "VOICE" },
  { key: "whatsapp", label: "WA" },
  { key: "google", label: "GOOGLE" },
  { key: "n8n", label: "N8N" },
];

export function StatusBar({ status }: { status?: Dashboard["status"] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-widest">
      {ITEMS.map(({ key, label }) => {
        const on = status?.[key];
        return (
          <span key={key} className="flex items-center gap-1.5" title={on ? `${label}: live` : `${label}: demo / not configured`}>
            <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-amber-400/70")} />
            <span className={on ? "text-emerald-200/90" : "text-hud-dim"}>{label}</span>
          </span>
        );
      })}
    </div>
  );
}
