"use client";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Select, TextInput } from "./ui";

interface Log {
  id: string;
  type: string;
  status: string;
  channel: string;
  summary: string;
  detail: string | null;
  error: string | null;
  createdAt: string;
}
const TYPES = ["ALL", "COMMAND", "WHATSAPP_SENT", "WHATSAPP_RECEIVED", "CALL_PLACED", "EMAIL_SCAN", "CALENDAR_CHECK", "CONFIG", "AUTH", "ERROR"];
const STATUSES = ["ALL", "SUCCESS", "FAILED", "MOCK", "SKIPPED"];
const tone: Record<string, string> = {
  SUCCESS: "border-emerald-400/40 text-emerald-200",
  FAILED: "border-rose-400/50 text-rose-200",
  MOCK: "border-amber-400/40 text-amber-200",
  SKIPPED: "border-slate-500/50 text-slate-300",
};

export function LogsTab() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ logs: Log[]; total: number; size: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ q, type, status, page: String(page), size: "25" });
    setData(await api(`/api/admin/logs?${p}`));
    setLoading(false);
  }, [q, type, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const pretty = (s: string | null) => {
    if (!s) return "";
    try {
      return JSON.stringify(JSON.parse(s), null, 2);
    } catch {
      return s;
    }
  };

  return (
    <div className="hud-panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display text-base font-bold tracking-wide text-cyan-100">Activity & Audit Log</h3>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-hud-dim" />
          <TextInput value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search summary, errors, details" className="pl-8" aria-label="Search logs" />
        </div>
        <Select className="w-auto flex-1 sm:flex-none" value={type} onChange={(e) => (setType(e.target.value), setPage(1))} options={TYPES.map((t) => ({ value: t, label: t === "ALL" ? "All types" : t.replace(/_/g, " ") }))} aria-label="Type filter" />
        <Select className="w-auto flex-1 sm:flex-none" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} options={STATUSES.map((t) => ({ value: t, label: t === "ALL" ? "All statuses" : t }))} aria-label="Status filter" />
        <button className="hud-btn h-[38px] w-[38px] p-0" onClick={load} aria-label="Refresh">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="hud-label text-left">
              <th className="pb-2 font-normal">Time</th>
              <th className="pb-2 font-normal">Type</th>
              <th className="pb-2 font-normal">Status</th>
              <th className="pb-2 font-normal">Summary</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.logs.map((l) => (
              <Fragment key={l.id}>
                <tr className="cursor-pointer border-t border-hud-line/60 hover:bg-cyan-500/5" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-hud-dim">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-cyan-200">{l.type.replace(/_/g, " ")}</td>
                  <td className="py-2 pr-3">
                    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px]", tone[l.status])}>{l.status}</span>
                    {l.channel !== "native" && <span className="ml-1 font-mono text-[10px] text-hud-dim">{l.channel}</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-200">
                    {l.summary}
                    {l.error && <span className="block truncate text-rose-300/90">{l.error}</span>}
                  </td>
                  <td className="py-2 text-hud-dim"><ChevronDown className={cn("h-4 w-4 transition", open === l.id && "rotate-180")} /></td>
                </tr>
                {open === l.id && (
                  <tr>
                    <td colSpan={5} className="pb-3">
                      <pre className="scrollbar-thin max-h-72 overflow-auto rounded-lg border border-hud-line bg-black/50 p-3 font-mono text-[11px] text-slate-300">
                        {l.error ? `ERROR: ${l.error}\n\n` : ""}
                        {pretty(l.detail) || "(no details)"}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {data && data.logs.length === 0 && <p className="py-8 text-center text-sm text-hud-dim">No log entries match.</p>}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-hud-dim">
        <span>{data?.total ?? 0} entries</span>
        <div className="flex items-center gap-2">
          <button className="hud-btn h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-mono">{page} / {pages}</span>
          <button className="hud-btn h-8 w-8 p-0" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
