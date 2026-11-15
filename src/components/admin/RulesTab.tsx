"use client";
import { Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, Section, Select, TextArea, TextInput, Toggle } from "./ui";
import type { AdminCtx } from "./types";

export function RulesTab({ ctx }: { ctx: AdminCtx }) {
  const { get, set } = ctx;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const preview = () => {
    const u = new SpeechSynthesisUtterance(`Good evening, ${get("ownerName")}. All systems are online.`);
    const v = voices.find((x) => x.name === get("voiceName"));
    if (v) u.voice = v;
    u.lang = v?.lang || get("voiceLang");
    u.rate = get<number>("voiceRate");
    u.pitch = get<number>("voicePitch");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="space-y-4">
      <Section title="Personality" description="How J.A.R.V.I.S. addresses you and behaves.">
        <Field label="Call me">
          <TextInput value={get("ownerName")} onChange={(e) => set("ownerName", e.target.value)} placeholder="Sir" />
        </Field>
        <Field label="Assistant name">
          <TextInput value={get("assistantName")} onChange={(e) => set("assistantName", e.target.value)} />
        </Field>
        <Field label="Timezone" hint="IANA name, e.g. Europe/London, America/New_York, Asia/Kolkata">
          <div className="flex gap-2">
            <TextInput value={get("timezone")} onChange={(e) => set("timezone", e.target.value)} />
            <button type="button" className="hud-btn shrink-0 text-xs" onClick={() => set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone)}>Detect</button>
          </div>
        </Field>
        <div />
        <Field label="System prompt" wide hint="Leave empty for the default witty British butler persona.">
          <TextArea
            value={get("systemPrompt")}
            onChange={(e) => set("systemPrompt", e.target.value)}
            className="min-h-[140px]"
            placeholder="You are J.A.R.V.I.S., a calm, witty, impeccably polite British AI butler. Address the user as 'Sir'. Keep spoken answers to 1-3 sentences…"
          />
        </Field>
      </Section>

      <Section title="Email Importance Rules" description="Criteria the AI uses to score emails 1–10. ≥8 = IMPORTANT, 5–7 = GOOD, ≤4 = IGNORE.">
        <Field label="Custom rules" wide hint="Plain English. The AI follows these strictly.">
          <TextArea
            value={get("emailRules")}
            onChange={(e) => set("emailRules", e.target.value)}
            className="min-h-[140px]"
            placeholder={"- Anything from my bank about failed payments is a 10\n- Recruiters are 3 unless they mention a specific role at a FAANG company\n- Calendar invites from clients are at least 7\n- GitHub notifications are 2 unless a PR is assigned to me"}
          />
        </Field>
        <Field label="VIP senders" hint="Emails or @domains, comma/newline separated">
          <TextArea value={get("vipSenders")} onChange={(e) => set("vipSenders", e.target.value)} className="min-h-[72px]" placeholder={"boss@company.com\n@starkindustries.com"} />
        </Field>
        <div className="grid gap-4">
          <Field label="Important keywords">
            <TextInput value={get("importantKeywords")} onChange={(e) => set("importantKeywords", e.target.value)} />
          </Field>
          <Field label="Ignore keywords">
            <TextInput value={get("ignoreKeywords")} onChange={(e) => set("ignoreKeywords", e.target.value)} />
          </Field>
        </div>
        <Field label="Max emails per scan">
          <TextInput type="number" min={1} max={100} value={get<number>("emailScanMaxResults")} onChange={(e) => set("emailScanMaxResults", Number(e.target.value))} />
        </Field>
      </Section>

      <Section title="Voice (in-browser)" description="Text-to-speech voice used on this device.">
        <Field label="Voice" wide>
          <Select
            value={get("voiceName")}
            onChange={(e) => set("voiceName", e.target.value)}
            options={[{ value: "", label: "Auto (best British English voice)" }, ...voices.map((v) => ({ value: v.name, label: `${v.name} — ${v.lang}` }))]}
          />
        </Field>
        <Field label={`Rate: ${get<number>("voiceRate").toFixed(2)}`}>
          <input type="range" min={0.5} max={2} step={0.05} value={get<number>("voiceRate")} onChange={(e) => set("voiceRate", Number(e.target.value))} className="w-full accent-cyan-400" />
        </Field>
        <Field label={`Pitch: ${get<number>("voicePitch").toFixed(2)}`}>
          <input type="range" min={0} max={2} step={0.05} value={get<number>("voicePitch")} onChange={(e) => set("voicePitch", Number(e.target.value))} className="w-full accent-cyan-400" />
        </Field>
        <Field label="Recognition language" hint="BCP-47, e.g. en-GB, en-US, en-IN">
          <TextInput value={get("voiceLang")} onChange={(e) => set("voiceLang", e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <Toggle checked={get<boolean>("speakResponses")} onChange={(v) => set("speakResponses", v)} label="Speak responses aloud" />
          <button type="button" className="hud-btn" onClick={preview}><Volume2 className="h-4 w-4" /> Preview voice</button>
        </div>
      </Section>
    </div>
  );
}
