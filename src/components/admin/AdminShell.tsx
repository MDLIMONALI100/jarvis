"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BellRing, Brain, Loader2, LogOut, Plug, Save, ScrollText, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { AlertsTab } from "./AlertsTab";
import { ContactsTab } from "./ContactsTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { LogsTab } from "./LogsTab";
import { RulesTab } from "./RulesTab";
import type { AdminCtx, Cfg, Status } from "./types";

const TABS = [
  { id: "integrations", label: "API & Webhooks", icon: Plug },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "rules", label: "AI Rules", icon: Brain },
  { id: "alerts", label: "Calls & Alerts", icon: BellRing },
  { id: "logs", label: "Logs", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

type ConfigResponse = { config: Cfg; secretsSet: Record<string, boolean>; status: Status };

export function AdminShell() {
  const [tab, setTab] = useState<TabId>("integrations");
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [appUrl, setAppUrl] = useState("");

  const reload = useCallback(async () => {
    setData(await api<ConfigResponse>("/api/admin/config"));
    setDraft({});
  }, []);

  useEffect(() => {
    setAppUrl(window.location.origin);
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab") as TabId | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
    const g = p.get("google");
    if (g) {
      setToast(
        g === "connected"
          ? { ok: true, msg: "Google account connected." }
          : { ok: false, msg: g === "missing-credentials" ? "Save Google client ID and secret first." : `Google connection failed${p.get("msg") ? `: ${p.get("msg")}` : ""}` },
      );
      window.history.replaceState(null, "", "/admin");
    }
    reload().catch((e) => setToast({ ok: false, msg: String(e) }));
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [tab]);

  const dirty = Object.keys(draft).length > 0;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const ctx: AdminCtx | null = useMemo(() => {
    if (!data) return null;
    return {
      cfg: data.config,
      secretsSet: data.secretsSet,
      status: data.status,
      draft,
      // Secret fields: draft value only (masked value never re-submitted).
      get: <T,>(k: string) => (k in draft ? draft[k] : k in data.secretsSet ? "" : data.config[k]) as T,
      set: (k, v) =>
        setDraft((d) => {
          const next = { ...d, [k]: v };
          if (!(k in data.secretsSet) && JSON.stringify(v) === JSON.stringify(data.config[k])) delete next[k];
          if (k in data.secretsSet && v === "") delete next[k];
          return next;
        }),
      reload,
      replace: (d) => {
        setData(d);
        setDraft({});
      },
    };
  }, [data, draft, reload]);

  const save = async () => {
    setSaving(true);
    try {
      setData(await api<ConfigResponse>("/api/admin/config", { method: "PUT", json: draft }));
      setDraft({});
      setToast({ ok: true, msg: "Settings saved." });
    } catch (e) {
      setToast({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const showSave = tab !== "contacts" && tab !== "logs";

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-3 pb-28 pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
      <header className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="hud-btn h-9 w-9 p-0" aria-label="Back to HUD"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-display text-lg font-bold tracking-[0.3em] text-cyan-200 glow-text">CONTROL PANEL</h1>
            <p className="hud-label">J.A.R.V.I.S. system configuration</p>
          </div>
        </div>
        <button onClick={logout} className="hud-btn text-xs"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
      </header>

      <nav className="scrollbar-thin -mx-3 mb-4 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
              tab === t.id ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-transparent text-hud-dim hover:text-cyan-100",
            )}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </nav>

      {!ctx ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>
      ) : (
        <>
          {tab === "integrations" && <IntegrationsTab ctx={ctx} appUrl={appUrl} />}
          {tab === "contacts" && <ContactsTab />}
          {tab === "rules" && <RulesTab ctx={ctx} />}
          {tab === "alerts" && <AlertsTab ctx={ctx} />}
          {tab === "logs" && <LogsTab />}
        </>
      )}

      <AnimatePresence>
        {showSave && dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-cyan-400/30 bg-[#03070d]/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur"
          >
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <p className="text-sm text-cyan-100">{Object.keys(draft).length} unsaved change{Object.keys(draft).length > 1 ? "s" : ""}</p>
              <div className="flex gap-2">
                <button className="hud-btn" onClick={() => setDraft({})}>Discard</button>
                <button className="hud-btn hud-btn-primary" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur",
              toast.ok ? "border-emerald-400/50 bg-emerald-950/90 text-emerald-100" : "border-rose-400/50 bg-rose-950/90 text-rose-100",
            )}
            role="status"
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
