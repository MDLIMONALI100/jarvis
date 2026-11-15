"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API typings (not in lib.dom for all TS versions).
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative; length: number }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export interface VoicePrefs { name?: string; rate?: number; pitch?: number; lang?: string }

/**
 * Speech-to-text (Web Speech API), text-to-speech (speechSynthesis) and a live
 * 0..1 audio level (mic analyser while listening, synthetic while speaking).
 */
export function useSpeech(onFinal: (text: string) => void, prefs: VoicePrefs) {
  const [supported, setSupported] = useState({ stt: false, tts: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const speakingRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    setSupported({ stt: Boolean(w.SpeechRecognition || w.webkitSpeechRecognition), tts: "speechSynthesis" in window });
    // Voices load async on Chrome.
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
      recRef.current?.abort();
    };
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setLevel(Math.min(1, sum / data.length / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Meter is cosmetic; recognition still works without it.
    }
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Try Chrome, Edge or Safari.");
      return;
    }
    if (speakingRef.current) window.speechSynthesis.cancel();
    const rec = new Ctor();
    rec.lang = prefsRef.current.lang || "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalText + interimText);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error === "not-allowed" ? "Microphone access was denied." : `Voice error: ${e.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      stopMeter();
      const t = finalText.trim();
      if (t) onFinalRef.current(t);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      startMeter();
    } catch (err) {
      setError(String(err));
    }
  }, [startMeter, stopMeter]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "link"));
    const p = prefsRef.current;
    const voices = synth.getVoices();
    const voice =
      (p.name && voices.find((v) => v.name === p.name)) ||
      voices.find((v) => v.lang === (p.lang || "en-GB") && /male|daniel|arthur|george|brian/i.test(v.name)) ||
      voices.find((v) => v.lang === (p.lang || "en-GB")) ||
      voices.find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.lang = voice?.lang || p.lang || "en-GB";
    u.rate = p.rate ?? 1;
    u.pitch = p.pitch ?? 0.9;
    let raf = 0;
    const pulse = () => {
      // Synthetic envelope so the orb "talks".
      const t = performance.now() / 1000;
      setLevel(0.35 + 0.25 * Math.abs(Math.sin(t * 7.3)) + 0.15 * Math.abs(Math.sin(t * 13.1)));
      raf = requestAnimationFrame(pulse);
    };
    u.onstart = () => {
      speakingRef.current = true;
      setSpeaking(true);
      pulse();
    };
    const done = () => {
      speakingRef.current = false;
      setSpeaking(false);
      cancelAnimationFrame(raf);
      setLevel(0);
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  }, []);

  const cancelSpeech = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return { supported, listening, speaking, interim, error, level, startListening, stopListening, speak, cancelSpeech };
}
