import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { timeAgo } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Empty, Panel } from "./Panel";
import type { MessageItem } from "./types";

const tone: Record<string, string> = {
  SENT: "text-cyan-300",
  DELIVERED: "text-emerald-300",
  READ: "text-emerald-300",
  RECEIVED: "text-sky-300",
  FAILED: "text-rose-300",
  MOCK: "text-amber-300",
  PENDING: "text-slate-400",
};

export function WhatsAppLog({ messages }: { messages: MessageItem[] }) {
  return (
    <Panel title="WhatsApp Log" icon={MessageCircle}>
      {messages.length === 0 ? (
        <Empty>No messages yet. Try “Send a WhatsApp to Mom saying I’ll be late”.</Empty>
      ) : (
        <ul className="scrollbar-thin -mr-2 max-h-[300px] space-y-1.5 overflow-y-auto pr-2">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-2 rounded-md bg-black/25 px-2.5 py-2">
              {m.direction === "OUTBOUND" ? (
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" aria-label="Sent" />
              ) : (
                <ArrowDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" aria-label="Received" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{m.contact?.name ?? m.phone}</span>
                  <span className={cn("shrink-0 font-mono text-[10px]", tone[m.status] ?? "text-slate-400")}>
                    {m.status === "MOCK" ? "SIMULATED" : m.status} · {timeAgo(m.createdAt)}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-slate-300/90">{m.body}</p>
                {m.error && <p className="mt-0.5 text-[11px] text-rose-300/90">{m.error}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
