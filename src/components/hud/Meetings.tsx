"use client";
import { CalendarClock, MapPin, PhoneCall, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Empty, Panel } from "./Panel";
import type { MeetingItem } from "./types";

function countdown(ms: number) {
  if (ms <= 0) return "IN PROGRESS";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function Meetings({ meetings, timezone, leadMinutes }: { meetings: MeetingItem[]; timezone: string; leadMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggle = async (m: MeetingItem) => {
    const next = !(overrides[m.id] ?? m.autoCall);
    setOverrides((o) => ({ ...o, [m.id]: next }));
    try {
      await api(`/api/calendar/${m.id}`, { method: "PATCH", json: { autoCall: next } });
    } catch {
      setOverrides((o) => ({ ...o, [m.id]: !next }));
    }
  };
  const fmt = (d: string) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(d));
  const demo = meetings.some((m) => m.isMock);

  return (
    <Panel title="Upcoming Meetings" icon={CalendarClock}>
      {demo && <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">Demo calendar — connect Google in admin</p>}
      {meetings.length === 0 ? (
        <Empty>No more meetings today.</Empty>
      ) : (
        <ul className="space-y-2">
          {meetings.map((m, i) => {
            const ms = new Date(m.startTime).getTime() - now;
            const auto = overrides[m.id] ?? m.autoCall;
            const soon = ms > 0 && ms < 15 * 60_000;
            return (
              <li key={m.id} className={cn("rounded-lg border bg-black/30 p-3", i === 0 ? "border-cyan-400/40" : "border-hud-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-hud-dim">
                      <span>{fmt(m.startTime)}{m.endTime ? ` – ${fmt(m.endTime)}` : ""}</span>
                      {m.location && (
                        <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{m.location}</span>
                      )}
                    </p>
                  </div>
                  <span className={cn("shrink-0 font-mono text-sm tabular-nums", soon ? "text-amber-300 glow-text" : ms <= 0 ? "text-emerald-300" : "text-cyan-200")}>
                    {countdown(ms)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-300">
                    <span
                      role="switch"
                      aria-checked={auto}
                      tabIndex={0}
                      onClick={() => toggle(m)}
                      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), toggle(m))}
                      className={cn("relative h-5 w-9 rounded-full border transition", auto ? "border-cyan-400/70 bg-cyan-500/30" : "border-slate-600 bg-slate-800")}
                    >
                      <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all", auto ? "left-[18px] bg-cyan-200" : "left-0.5 bg-slate-400")} />
                    </span>
                    <PhoneCall className="h-3 w-3" />
                    {m.callTriggered ? "Call placed" : `Auto-call ${leadMinutes}m before`}
                  </label>
                  {m.meetLink && (
                    <a href={m.meetLink} target="_blank" rel="noreferrer" className="hud-btn px-2 py-1 text-[11px]">
                      <Video className="h-3 w-3" /> Join
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
