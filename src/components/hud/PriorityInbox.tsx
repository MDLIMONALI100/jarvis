"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Inbox, Loader2, RefreshCw, Reply } from "lucide-react";
import { useState } from "react";
import { api, timeAgo } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Empty, Panel } from "./Panel";
import type { EmailItem } from "./types";

function scoreTone(score: number) {
  if (score >= 9) return "border-rose-500/60 bg-rose-500/15 text-rose-200";
  if (score >= 8) return "border-amber-400/60 bg-amber-400/10 text-amber-200";
  return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
}

export function PriorityInbox({ emails, onChange, onScan, scanning }: { emails: EmailItem[]; onChange: () => void; onScan: () => void; scanning: boolean }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const dismiss = async (id: string) => {
    setHidden((h) => new Set(h).add(id));
    await api(`/api/emails/${id}`, { method: "PATCH", json: { dismissed: true } }).catch(() => {});
    onChange();
  };
  const replyHref = (e: EmailItem) =>
    e.isMock || !e.threadId
      ? `mailto:${e.fromEmail}?subject=${encodeURIComponent(`Re: ${e.subject}`)}`
      : `https://mail.google.com/mail/u/0/#inbox/${e.threadId}`;
  const quick = (e: EmailItem, text: string) =>
    `mailto:${e.fromEmail}?subject=${encodeURIComponent(`Re: ${e.subject}`)}&body=${encodeURIComponent(text)}`;

  const visible = emails.filter((e) => !hidden.has(e.id));
  const demo = emails.some((e) => e.isMock);

  return (
    <Panel
      title="Priority Inbox"
      icon={Inbox}
      action={
        <button className="hud-btn px-2 py-1 text-xs" onClick={onScan} disabled={scanning} aria-label="Scan inbox">
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Scan
        </button>
      }
    >
      {demo && <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-300/80">Demo inbox — connect Gmail in admin</p>}
      {visible.length === 0 ? (
        <Empty>No important emails. Inbox is under control.</Empty>
      ) : (
        <ul className="scrollbar-thin -mr-2 max-h-[420px] space-y-2 overflow-y-auto pr-2">
          <AnimatePresence initial={false}>
            {visible.map((e) => (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="rounded-lg border border-hud-line bg-black/30 p-3"
              >
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-xs font-bold", scoreTone(e.score))} title={`Importance ${e.score}/10`}>
                    {e.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-hud-text">{e.fromName}</p>
                      <span className="shrink-0 font-mono text-[10px] text-hud-dim">{timeAgo(e.receivedAt)}</span>
                    </div>
                    <p className="truncate text-xs text-cyan-200/80">{e.subject}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300/90">{e.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a className="hud-btn px-2 py-1 text-[11px]" href={replyHref(e)} target="_blank" rel="noreferrer">
                        <Reply className="h-3 w-3" /> Reply
                      </a>
                      <a className="hud-btn px-2 py-1 text-[11px]" href={quick(e, "Thanks — received. I'll get back to you shortly.")}>
                        Got it
                      </a>
                      <a className="hud-btn px-2 py-1 text-[11px]" href={quick(e, "Can we discuss this on a quick call today?")}>
                        Let&apos;s talk
                      </a>
                      <button className="hud-btn px-2 py-1 text-[11px]" onClick={() => dismiss(e.id)} aria-label="Dismiss">
                        <Check className="h-3 w-3" /> Done
                      </button>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Panel>
  );
}
