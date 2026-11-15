import { z } from "zod";
import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { placeCall } from "@/lib/services/voice";
import { sendWhatsApp } from "@/lib/services/whatsapp";
import { completeText, llmEnabled, personaPrompt } from "@/lib/services/llm";
import { fetchEvents, fetchUnreadEmails, googleLive } from "@/lib/services/google";
import { forwardToN8n } from "@/lib/services/n8n";

export const maxDuration = 60;

export const POST = handler("admin/test", async (req: Request) => {
  const { type, to } = z.object({ type: z.enum(["call", "whatsapp", "llm", "google", "n8n"]), to: z.string().max(40).optional() }).parse(await req.json());
  const cfg = await getConfig();
  switch (type) {
    case "call": {
      const r = await placeCall(cfg, `Hello ${cfg.ownerName}. This is a test call from ${cfg.assistantName}. All systems are operational.`, { to, reason: "test" });
      return json({ ok: r.ok, channel: r.channel, message: r.ok ? (r.channel === "mock" ? "Simulated call logged (no provider configured)." : `Call queued (${r.ref}).`) : r.error });
    }
    case "whatsapp": {
      const target = to || cfg.personalPhone;
      if (!target) return json({ ok: false, message: "Set your personal phone number first." });
      const r = await sendWhatsApp(cfg, target, `✅ Test message from ${cfg.assistantName}. All systems operational.`, { reason: "test" });
      return json({ ok: r.ok, channel: r.channel, message: r.ok ? (r.channel === "mock" ? "Simulated message logged (no provider configured)." : `Sent (${r.ref}).`) : r.error });
    }
    case "llm": {
      if (!llmEnabled(cfg)) return json({ ok: false, message: "Choose a provider and add its API key first." });
      const t0 = Date.now();
      try {
        const text = await completeText(cfg, personaPrompt(cfg), "Confirm you are online in one short sentence.");
        return json({ ok: true, message: `${text} (${Date.now() - t0} ms)` });
      } catch (e) {
        return json({ ok: false, message: e instanceof Error ? e.message.slice(0, 300) : String(e) });
      }
    }
    case "google": {
      if (!googleLive(cfg)) return json({ ok: false, message: "Google is not connected — using demo data." });
      const [mail, events] = await Promise.all([fetchUnreadEmails(cfg, 5), fetchEvents(cfg, new Date(), new Date(Date.now() + 86_400_000))]);
      return json({ ok: true, message: `Connected as ${cfg.googleEmail ?? "unknown"}: ${mail.length} unread (sample), ${events.length} events in 24h.` });
    }
    case "n8n": {
      const r = await forwardToN8n({ ...cfg, n8nEnabled: true }, "command", { text: "ping", test: true });
      return json({ ok: r.ok, message: r.ok ? "n8n webhook responded." : r.error });
    }
  }
});
