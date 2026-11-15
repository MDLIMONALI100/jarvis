"use client";
import { Bot, Link2, Unlink, Webhook } from "lucide-react";
import { api } from "@/lib/client";
import { Badge, Field, Section, SecretInput, Select, TextInput, Toggle } from "./ui";
import { TestButton } from "./TestButton";
import type { AdminCtx } from "./types";

const N8N_ACTIONS = [
  { key: "whatsapp", label: "WhatsApp send", hint: "Payload: { to, body, contactName }" },
  { key: "call", label: "Outbound call", hint: "Payload: { to, message, reason }" },
  { key: "meetingAlert", label: "Meeting alert", hint: "Replaces the native meeting call" },
  { key: "emailTriage", label: "Urgent email", hint: "Fired for each email ≥ urgent threshold" },
  { key: "command", label: "Command (optional)", hint: "Return { reply } to override Jarvis' answer" },
];

const MODEL_HINT: Record<string, string> = {
  openai: "Default: gpt-4o-mini",
  anthropic: "Default: claude-opus-5-5",
  gemini: "Default: gemini-flash-lite-latest (fast, free, auto-updating)",
  mock: "Offline rule-based parser — no AI key needed",
};

export function IntegrationsTab({ ctx, appUrl }: { ctx: AdminCtx; appUrl: string }) {
  const { get, set, secretsSet, cfg, status } = ctx;
  const secret = (k: string, placeholder?: string) => (
    <SecretInput value={ctx.draft[k] as string | null | undefined} masked={String(cfg[k] ?? "")} isSet={secretsSet[k]} onChange={(v) => set(k, v)} placeholder={placeholder} />
  );
  const llm = get("llmProvider");
  const voice = get("voiceProvider");
  const wa = get("whatsappProvider");
  const hooks = get<Record<string, string>>("n8nWebhooks") ?? {};

  return (
    <div className="space-y-4">
      <Section title="AI Language Model" description="Used for intent parsing, email scoring and conversation." actions={<Badge on={status.llm}>{status.llm ? "Live" : "Mock mode"}</Badge>}>
        <Field label="Provider">
          <Select
            value={llm}
            onChange={(e) => set("llmProvider", e.target.value)}
            options={[
              { value: "mock", label: "Offline (no AI)" },
              { value: "anthropic", label: "Anthropic Claude" },
              { value: "openai", label: "OpenAI" },
              { value: "gemini", label: "Google Gemini" },
            ]}
          />
        </Field>
        <Field label="Model override" hint={MODEL_HINT[llm]}>
          <TextInput value={get("llmModel")} onChange={(e) => set("llmModel", e.target.value)} placeholder="(default)" disabled={llm === "mock"} />
        </Field>
        <Field label="Anthropic API key">{secret("anthropicApiKey", "sk-ant-…")}</Field>
        <Field label="OpenAI API key">{secret("openaiApiKey", "sk-…")}</Field>
        <Field label="Gemini API key">{secret("geminiApiKey", "AIza…")}</Field>
        <div className="self-end">
          <TestButton type="llm" label="Test AI connection" icon={Bot} />
        </div>
      </Section>

      <Section title="Voice Calls" description="Outbound phone calls to your number (alerts, reminders, “call me”)." actions={<Badge on={status.voice}>{status.voice ? "Live" : "Simulated"}</Badge>}>
        <Field label="Provider" wide>
          <Select
            value={voice}
            onChange={(e) => set("voiceProvider", e.target.value)}
            options={[
              { value: "mock", label: "Simulated (log only)" },
              { value: "vapi", label: "Vapi.ai (conversational AI voice)" },
              { value: "twilio", label: "Twilio Voice (text-to-speech)" },
            ]}
          />
        </Field>
        {voice === "vapi" && (
          <>
            <Field label="Vapi private API key">{secret("vapiApiKey")}</Field>
            <Field label="Vapi phone number ID" hint="Dashboard → Phone Numbers">
              <TextInput value={get("vapiPhoneNumberId") ?? ""} onChange={(e) => set("vapiPhoneNumberId", e.target.value || null)} />
            </Field>
            <Field label="Vapi assistant ID (optional)" hint="Leave empty to use a built-in transient assistant">
              <TextInput value={get("vapiAssistantId") ?? ""} onChange={(e) => set("vapiAssistantId", e.target.value || null)} />
            </Field>
            <Field label="Vapi public key (optional)" hint="Reserved for in-browser WebRTC calls">{secret("vapiPublicKey")}</Field>
          </>
        )}
        {(voice === "twilio" || wa === "twilio") && (
          <>
            <Field label="Twilio Account SID">
              <TextInput value={get("twilioAccountSid") ?? ""} onChange={(e) => set("twilioAccountSid", e.target.value || null)} placeholder="AC…" />
            </Field>
            <Field label="Twilio Auth Token">{secret("twilioAuthToken")}</Field>
          </>
        )}
        {voice === "twilio" && (
          <>
            <Field label="Twilio caller number" hint="A voice-capable Twilio number, E.164">
              <TextInput value={get("twilioFromNumber") ?? ""} onChange={(e) => set("twilioFromNumber", e.target.value || null)} placeholder="+15551234567" />
            </Field>
            <Field label="Twilio TTS voice" hint="e.g. Polly.Brian, Polly.Amy, Google.en-GB-Neural2-B">
              <TextInput value={get("twilioVoice")} onChange={(e) => set("twilioVoice", e.target.value)} />
            </Field>
          </>
        )}
      </Section>

      <Section title="WhatsApp" description="Send messages to contacts and receive replies." actions={<Badge on={status.whatsapp}>{status.whatsapp ? "Live" : "Simulated"}</Badge>}>
        <Field label="Provider" wide>
          <Select
            value={wa}
            onChange={(e) => set("whatsappProvider", e.target.value)}
            options={[
              { value: "mock", label: "Simulated (log only)" },
              { value: "cloud", label: "WhatsApp Business Cloud API (Meta)" },
              { value: "twilio", label: "Twilio WhatsApp" },
            ]}
          />
        </Field>
        {wa === "cloud" && (
          <>
            <Field label="Permanent access token">{secret("whatsappToken", "EAAG…")}</Field>
            <Field label="Phone number ID">
              <TextInput value={get("whatsappPhoneId") ?? ""} onChange={(e) => set("whatsappPhoneId", e.target.value || null)} />
            </Field>
            <Field label="Webhook verify token" hint="Any random string; paste the same in Meta">{secret("whatsappVerifyToken")}</Field>
            <Field label="App secret" hint="Enables X-Hub-Signature-256 verification">{secret("whatsappAppSecret")}</Field>
          </>
        )}
        {wa === "twilio" && (
          <>
            <Field label="Twilio WhatsApp sender" hint="Sandbox: +14155238886">
              <TextInput value={get("twilioWhatsappFrom") ?? ""} onChange={(e) => set("twilioWhatsappFrom", e.target.value || null)} placeholder="+14155238886" />
            </Field>
          </>
        )}
        {wa !== "mock" && (
          <Field label="Inbound webhook URL" wide hint="Configure this as the callback URL in Meta / Twilio">
            <TextInput readOnly value={`${appUrl}/api/whatsapp/webhook`} onFocus={(e) => e.currentTarget.select()} />
          </Field>
        )}
      </Section>

      <Section
        title="Google — Gmail & Calendar"
        description="Read-only access to unread mail and your calendar via OAuth 2.0."
        actions={<Badge on={status.google}>{status.google ? `Connected${cfg.googleEmail ? `: ${cfg.googleEmail}` : ""}` : "Demo data"}</Badge>}
      >
        <Field label="OAuth client ID">
          <TextInput value={get("googleClientId") ?? ""} onChange={(e) => set("googleClientId", e.target.value || null)} placeholder="…apps.googleusercontent.com" />
        </Field>
        <Field label="OAuth client secret">{secret("googleClientSecret", "GOCSPX-…")}</Field>
        <Field label="Authorized redirect URI" hint="Add exactly this in Google Cloud Console → Credentials" wide>
          <TextInput readOnly value={`${appUrl}/api/google/callback`} onFocus={(e) => e.currentTarget.select()} />
        </Field>
        <Field label="Calendar ID">
          <TextInput value={get("googleCalendarId")} onChange={(e) => set("googleCalendarId", e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2 self-end sm:flex-row">
          {status.googleCredentials ? (
            <a href="/api/google/auth" className="hud-btn hud-btn-primary flex-1">
              <Link2 className="h-4 w-4" /> {status.google ? "Reconnect" : "Connect Google"}
            </a>
          ) : (
            <p className="text-xs text-amber-200/80">Save client ID + secret, then connect.</p>
          )}
          {status.google && (
            <button
              type="button"
              className="hud-btn hud-btn-danger"
              onClick={async () => {
                if (confirm("Disconnect Google? Jarvis will fall back to demo data.")) ctx.replace(await api("/api/admin/config?what=google", { method: "DELETE" }));
              }}
            >
              <Unlink className="h-4 w-4" /> Disconnect
            </button>
          )}
        </div>
        <div className="sm:col-span-2">
          <TestButton type="google" label="Test Google access" icon={Link2} disabled={!status.google} />
        </div>
      </Section>

      <Section title="n8n Webhook Bridge" description="When enabled, actions with a URL are forwarded to n8n instead of running natively." actions={<Badge on={status.n8n}>{status.n8n ? "Active" : "Off"}</Badge>}>
        <div className="sm:col-span-2">
          <Toggle checked={get<boolean>("n8nEnabled")} onChange={(v) => set("n8nEnabled", v)} label="Enable n8n bridge" hint="Actions without a URL keep running natively." />
        </div>
        {N8N_ACTIONS.map((a) => (
          <Field key={a.key} label={a.label} hint={a.hint}>
            <TextInput
              value={hooks[a.key] ?? ""}
              onChange={(e) => set("n8nWebhooks", { ...hooks, [a.key]: e.target.value })}
              placeholder="https://n8n.example.com/webhook/…"
              type="url"
            />
          </Field>
        ))}
        <Field label="Shared secret" hint="Sent as X-Jarvis-Secret header">{secret("n8nSecret")}</Field>
        <div className="self-end">
          <TestButton type="n8n" label="Ping command webhook" icon={Webhook} disabled={!hooks.command} />
        </div>
      </Section>
    </div>
  );
}
