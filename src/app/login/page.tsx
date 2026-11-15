"use client";
import { Loader2, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) {
      const next = params.get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setError(d.error ?? "Access denied.");
    setPassword("");
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="hud-panel w-full max-w-sm space-y-4 p-6">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="h-20 w-20 rounded-full"
          style={{ background: "radial-gradient(circle at 50% 45%, #fff 0%, #67e8f9 22%, rgba(8,145,178,.85) 55%, transparent 75%)", boxShadow: "0 0 40px rgba(34,211,238,.5)" }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <h1 className="font-display text-2xl font-bold tracking-[0.35em] text-cyan-200 glow-text">J.A.R.V.I.S.</h1>
        <p className="hud-label">Identity verification required</p>
      </div>
      <label className="block">
        <span className="sr-only">Password or PIN</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-dim" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password or PIN"
            className="hud-input h-12 pl-9 text-center text-lg tracking-[0.3em]"
          />
        </div>
      </label>
      {error && <p className="text-center text-sm text-rose-300" role="alert">{error}</p>}
      <button className="hud-btn hud-btn-primary h-12 w-full text-sm uppercase tracking-[0.25em]" disabled={!password || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Authenticate"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
