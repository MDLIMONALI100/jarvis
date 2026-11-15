"use client";
import { motion } from "framer-motion";
import type { OrbState } from "@/hooks/useSpeech";

const COLORS: Record<OrbState, { core: string; ring: string; glow: string }> = {
  idle: { core: "#67e8f9", ring: "rgba(56,189,248,.55)", glow: "rgba(34,211,238,.35)" },
  listening: { core: "#a5f3fc", ring: "rgba(103,232,249,.9)", glow: "rgba(34,211,238,.65)" },
  thinking: { core: "#fcd34d", ring: "rgba(245,158,11,.75)", glow: "rgba(245,158,11,.45)" },
  speaking: { core: "#e0f2fe", ring: "rgba(125,211,252,.9)", glow: "rgba(56,189,248,.7)" },
};

export function Orb({ state, level, onClick, size = 240 }: { state: OrbState; level: number; onClick?: () => void; size?: number }) {
  const c = COLORS[state];
  const s = 1 + level * 0.28;
  const label = { idle: "Tap to speak", listening: "Listening… tap to stop", thinking: "Processing", speaking: "Speaking — tap to interrupt" }[state];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
      style={{ width: size, height: size }}
    >
      {/* Outer dashed ring */}
      <motion.svg
        className="absolute inset-0"
        viewBox="0 0 200 200"
        animate={{ rotate: 360 }}
        transition={{ duration: state === "thinking" ? 4 : 24, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke={c.ring} strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="88" fill="none" stroke={c.ring} strokeWidth="1.5" strokeDasharray="40 14 8 14" />
      </motion.svg>
      {/* Counter ring */}
      <motion.svg
        className="absolute inset-[10%]"
        viewBox="0 0 200 200"
        animate={{ rotate: -360 }}
        transition={{ duration: state === "thinking" ? 2.5 : 16, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="100" cy="100" r="94" fill="none" stroke={c.ring} strokeWidth="3" strokeDasharray="70 220" strokeLinecap="round" />
        <circle cx="100" cy="100" r="80" fill="none" stroke={c.ring} strokeOpacity=".35" strokeWidth="1" />
      </motion.svg>
      {/* Audio-reactive halo */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: "22%", background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`, filter: "blur(18px)" }}
        animate={{ scale: state === "idle" ? [1, 1.08, 1] : s * 1.25, opacity: state === "idle" ? [0.6, 0.9, 0.6] : 0.7 + level * 0.3 }}
        transition={state === "idle" ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 300, damping: 20 }}
      />
      {/* Core */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: "30%",
          background: `radial-gradient(circle at 50% 45%, #ffffff 0%, ${c.core} 22%, rgba(8,145,178,.85) 55%, rgba(8,51,68,.2) 80%, transparent 100%)`,
          boxShadow: `0 0 40px ${c.glow}, inset 0 0 30px rgba(255,255,255,.25)`,
        }}
        animate={{ scale: state === "idle" ? [1, 1.03, 1] : s }}
        transition={state === "idle" ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : { type: "spring", stiffness: 420, damping: 18 }}
      />
      {/* Equalizer bars around the core while active */}
      {(state === "listening" || state === "speaking") && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 36 }).map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 h-0 w-0"
              style={{ transform: `rotate(${i * 10}deg) translateY(-${size * 0.36}px)` }}
            >
              <motion.span
                className="absolute bottom-0 left-[-1px] block w-[2px] origin-bottom rounded bg-cyan-200/80"
                style={{ height: size * 0.06 }}
                animate={{ scaleY: 0.4 + level * (1.8 + ((i * 7) % 5) * 0.4) }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              />
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
