"use client";
import { Activity, Keyboard, Mic, MicOff, Send, Settings, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Orb } from "@/components/Orb";
import { useSpeech, type OrbState } from "@/hooks/useSpeech";
import { api, timeAgo } from "@/lib/client";
import { ChatLog } from "./ChatLog";
import { Meetings } from "./Meetings";
import { Panel } from "./Panel";
import { PriorityInbox } from "./PriorityInbox";
import { QuickActions } from "./QuickActions";
import { StatusBar } from "./StatusBar";
import { PushBell } from "@/components/PushBell";
import { WhatsAppLog } from "./WhatsAppLog";
import type { ChatEntry, Dashboard } from "./types";

const uid = () => Math.random().toString(36).slice(2);
const SUGGESTIONS = ["Which emails are important today?", "Remind me about my next meeting", "Send a WhatsApp to Mom saying I'll be home by 8", "Give me my daily briefing"];

export function Hud() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState<"call" | "scan" | "briefing" | null>(null);
  const [muted, setMuted] = useState(false);
  const [clock, setClock] = useState("");
  const [orbSize, setOrbSize] = useState(240);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Dashboard>("/api/dashboard"));
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e instanceof Error ? e.message : e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    const c = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    const resize = () => setOrbSize(window.innerWidth < 640 ? 200 : 250);
    resize();
    window.addEventListener("resize", resize);
    try {
      setMuted(localStorage.getItem("jarvis:muted") === "1");
    } catch {}
    return () => {
      clearInterval(t);
      clearInterval(c);
      window.removeEventListener("resize", resize);
    };
  }, [load]);

  const say = (text: string, extra: Partial<ChatEntry> = {}) => {
    setEntries((e) => [...e.slice(-40), { id: uid(), role: "jarvis", text, ...extra }]);
    if (!muted && data?.voice.speak !== false) speech.speak(text);
  };

  const run = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setEntries((e) => [...e.slice(-40), { id: uid(), role: "user", text: t }]);
    setInput("");
    setThinking(true);
    try {
      const r = await api<{ reply: string; intent: string; success: boolean }>("/api/command", { method: "POST", json: { text: t } });
      say(r.reply, { intent: r.intent, success: r.success });
      load();
    } catch (e) {
      say(`I'm afraid something went wrong: ${e instanceof Error ? e.message : e}`, { success: false });
    } finally {
      setThinking(false);
    }
  };

  const speech = useSpeech(run, data?.voice ?? {});
  const orbState: OrbState = speech.listening ? "listening" : thinking ? "thinking" : speech.speaking ? "speaking" : "idle";

  const onOrb = () => {
    if (speech.speaking) return speech.cancelSpeech();
    if (speech.listening) return speech.stopListening();
    if (!speech.supported.stt) {
      inputRef.current?.focus();
      return;
    }
    speech.startListening();
  };

  const quick = async (k: "call" | "scan" | "briefing") => {
    setBusy(k);
    try {
      if (k === "call") {
        const r = await api<{ ok: boolean; channel: string; error?: string }>("/api/call/trigger", { method: "POST", json: {} }).catch((e) => ({ ok: false, channel: "native", error: String(e.message ?? e) }));
        say(r.ok ? (r.channel === "mock" ? "Simulated call placed. Configure a voice provider to ring your phone." : "Calling your phone now.") : `Call failed: ${r.error}`, { intent: "CALL_ME", success: r.ok });
      } else if (k === "scan") {
        const r = await api<{ fetched: number; new: number; important: number; alerts: number }>("/api/emails/sync", { method: "POST" });
        say(`Inbox scanned. ${r.new} new message${r.new === 1 ? "" : "s"}, ${r.important} worth your attention${r.alerts ? `, ${r.alerts} urgent alert${r.alerts > 1 ? "s" : ""} sent` : ""}.`, { intent: "SCAN_INBOX", success: true });
      } else {
        const r = await api<{ text: string }>("/api/briefing");
        say(r.text, { intent: "DAILY_BRIEFING", success: true });
      }
      load();
    } catch (e) {
      say(`That didn't work: ${e instanceof Error ? e.message : e}`, { success: false });
    } finally {
      setBusy(null);
    }
  };

  // PWA shortcuts: /?action=briefing|call
  const handledAction = useRef(false);
  useEffect(() => {
    if (!data || handledAction.current) return;
    handledAction.current = true;
    const a = new URLSearchParams(window.location.search).get("action");
    if (a === "briefing" || a === "call" || a === "scan") {
      window.history.replaceState(null, "", "/");
      quick(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) speech.cancelSpeech();
    try {
      localStorage.setItem("jarvis:muted", next ? "1" : "0");
    } catch {}
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1500px] flex-col px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 py-2">
        <div>
          <h1 className="font-display text-xl font-bold tracking-[0.35em] text-cyan-200 glow-text sm:text-2xl">{data?.assistant ?? "J.A.R.V.I.S."}</h1>
          <StatusBar status={data?.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-sm tabular-nums text-cyan-200/80 sm:block">{clock}</span>
          <PushBell onMessage={(t) => setEntries((e) => [...e.slice(-40), { id: uid(), role: "jarvis", text: t }])} />
          <button className="hud-btn h-9 w-9 p-0" onClick={toggleMute} aria-label={muted ? "Unmute voice" : "Mute voice"}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Link href="/admin" className="hud-btn h-9 w-9 p-0" aria-label="Admin panel">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {loadError && <p className="mb-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">Systems offline: {loadError}</p>}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(420px,1.25fr)_minmax(300px,1fr)]">
        {/* Command center (first on mobile) */}
        <section className="order-1 flex flex-col gap-3 lg:order-2">
          <div className="hud-panel flex flex-col items-center gap-2 px-3 pb-3 pt-5">
            <Orb state={orbState} level={speech.level} onClick={onOrb} size={orbSize} />
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/80">
              {orbState === "idle" ? (speech.supported.stt ? "Tap the core to speak" : "Type a command below") : orbState === "listening" ? "Listening" : orbState === "thinking" ? "Processing" : "Speaking"}
            </p>
            {speech.error && <p className="text-xs text-rose-300">{speech.error}</p>}

            <div className="w-full">
              {entries.length === 0 && !speech.interim ? (
                <div className="flex flex-wrap justify-center gap-1.5 py-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => run(s)} className="rounded-full border border-hud-line bg-black/30 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-100">
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <ChatLog entries={entries} interim={speech.interim} thinking={thinking} />
              )}
            </div>

            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(input);
              }}
            >
              <div className="relative flex-1">
                <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hud-dim" />
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Give J.A.R.V.I.S. a command…"
                  className="hud-input h-11 pl-9 text-base sm:text-sm"
                  enterKeyHint="send"
                  autoComplete="off"
                  aria-label="Command"
                />
              </div>
              <button type="button" onClick={onOrb} className="hud-btn h-11 w-11 p-0" aria-label={speech.listening ? "Stop listening" : "Start voice input"} disabled={!speech.supported.stt}>
                {speech.listening ? <MicOff className="h-4 w-4 text-rose-300" /> : <Mic className="h-4 w-4" />}
              </button>
              <button type="submit" className="hud-btn hud-btn-primary h-11 w-11 p-0" disabled={!input.trim() || thinking} aria-label="Send command">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
          <QuickActions busy={busy} onAction={quick} />
        </section>

        {/* Left column */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          <PriorityInbox emails={data?.emails ?? []} onChange={load} onScan={() => quick("scan")} scanning={busy === "scan"} />
        </div>

        {/* Right column */}
        <div className="order-3 flex min-w-0 flex-col gap-4">
          <Meetings meetings={data?.meetings ?? []} timezone={data?.timezone ?? "UTC"} leadMinutes={data?.callLeadMinutes ?? 10} />
          <WhatsAppLog messages={data?.messages ?? []} />
          <Panel title="Activity" icon={Activity}>
            <ul className="space-y-1">
              {(data?.activity ?? []).slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className={a.status === "FAILED" ? "text-rose-400" : a.status === "MOCK" ? "text-amber-300" : "text-emerald-300"}>●</span>
                  <span className="min-w-0 flex-1 truncate text-slate-300">{a.summary}</span>
                  <span className="shrink-0 font-mono text-[10px] text-hud-dim">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </main>
  );
}
