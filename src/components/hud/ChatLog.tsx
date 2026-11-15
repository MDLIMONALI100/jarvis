"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChatEntry } from "./types";

export function ChatLog({ entries, interim, thinking }: { entries: ChatEntry[]; interim: string; thinking: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollIntoView,
    // which React would otherwise treat as an effect cleanup.
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, interim, thinking]);

  return (
    <div className="scrollbar-thin max-h-[32vh] min-h-[96px] space-y-2 overflow-y-auto px-1 lg:max-h-[38vh]" aria-live="polite">
      <AnimatePresence initial={false}>
        {entries.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", e.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                e.role === "user"
                  ? "rounded-br-sm border border-cyan-400/30 bg-cyan-500/10 text-cyan-50"
                  : cn("rounded-bl-sm border bg-black/40", e.success === false ? "border-rose-500/30 text-rose-100" : "border-hud-line text-hud-text"),
              )}
            >
              {e.role === "jarvis" && e.intent && e.intent !== "CHAT" && (
                <span className="mb-0.5 block font-mono text-[9px] uppercase tracking-widest text-cyan-400/70">{e.intent.replace(/_/g, " ")}</span>
              )}
              {e.text}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {interim && (
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-xl rounded-br-sm border border-dashed border-cyan-400/30 px-3 py-2 text-sm italic text-cyan-100/70">{interim}…</div>
        </div>
      )}
      {thinking && (
        <div className="flex gap-1 px-2 py-1" aria-label="Thinking">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-amber-300" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      )}
      <div ref={end} />
    </div>
  );
}
