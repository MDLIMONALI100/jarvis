import { Loader2, PhoneOutgoing, ScanSearch, Sunrise, type LucideIcon } from "lucide-react";

type Key = "call" | "scan" | "briefing";
const ACTIONS: { key: Key; label: string; icon: LucideIcon }[] = [
  { key: "call", label: "Call Me Now", icon: PhoneOutgoing },
  { key: "scan", label: "Scan Inbox", icon: ScanSearch },
  { key: "briefing", label: "Daily Briefing", icon: Sunrise },
];

export function QuickActions({ busy, onAction }: { busy: Key | null; onAction: (k: Key) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onAction(key)}
          disabled={busy !== null}
          className="hud-btn min-h-[64px] flex-col gap-1 py-3 text-[11px] uppercase tracking-wider sm:min-h-[72px] sm:text-xs"
        >
          {busy === key ? <Loader2 className="h-5 w-5 animate-spin text-cyan-300" /> : <Icon className="h-5 w-5 text-cyan-300" />}
          {label}
        </button>
      ))}
    </div>
  );
}
