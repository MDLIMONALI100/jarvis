import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        hud: {
          bg: "#03070d",
          panel: "rgba(8, 20, 33, 0.72)",
          line: "rgba(56, 189, 248, 0.18)",
          cyan: "#38bdf8",
          glow: "#22d3ee",
          amber: "#f59e0b",
          red: "#f43f5e",
          green: "#34d399",
          text: "#d6f3ff",
          dim: "#6b8ba3",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        hud: "0 0 0 1px rgba(56,189,248,.18), 0 0 24px -6px rgba(34,211,238,.35)",
      },
      keyframes: {
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
      },
      animation: { scan: "scan 6s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
