import "server-only";
import type { ResolvedConfig } from "../config";
import type { Intent, ParsedIntent } from "../types";
import { completeJson, llmEnabled, personaPrompt } from "./llm";

const INTENTS: Intent[] = ["SEND_WHATSAPP", "CHECK_EMAILS", "SCAN_INBOX", "CALL_ME", "NEXT_MEETING", "TODAY_MEETINGS", "DAILY_BRIEFING", "CHAT"];

/** Offline regex parser: powers mock mode and acts as LLM fallback. */
export function parseIntentRules(raw: string): ParsedIntent {
  const text = raw.trim().replace(/[.!?]+$/, "");
  const lower = text.toLowerCase();

  // "send a whatsapp (message) to Mom saying ...", "whatsapp John that ...", "text Boss: ..."
  const wa =
    text.match(/(?:send\s+(?:a\s+)?)?(?:whats\s?app|message|text|msg)(?:\s+message)?\s+(?:to\s+)?(.+?)\s+(?:saying|that says|that|telling (?:them|him|her)|with(?: the)? message|:)\s+(.+)/i) ??
    text.match(/(?:tell|let)\s+(.+?)\s+(?:know\s+)?(?:that\s+)?(?:on|via)\s+whats\s?app\s+(.+)/i);
  if (wa) return { intent: "SEND_WHATSAPP", contact: wa[1].trim(), message: wa[2].trim() };

  if (/\b(call|ring|phone)\s+(me|my (cell|phone|mobile))\b|call my phone/.test(lower)) return { intent: "CALL_ME" };
  if (/\b(scan|sync|refresh|check)\b.*\b(inbox|mail|emails?)\b.*\b(now|again)\b|^scan( my)? inbox/.test(lower)) return { intent: "SCAN_INBOX" };
  if (/\b(e-?mails?|inbox|mail)\b/.test(lower)) return { intent: "CHECK_EMAILS" };
  if (/\b(brief(ing)?|summary of (my|the) day|what('s| is) (on|happening) today|morning report)\b/.test(lower)) return { intent: "DAILY_BRIEFING" };
  if (/\bnext (meeting|event|appointment|call)\b|remind me about my (next )?meeting/.test(lower)) return { intent: "NEXT_MEETING" };
  if (/\b(meetings?|calendar|schedule|agenda|appointments?)\b/.test(lower)) return { intent: "TODAY_MEETINGS" };
  return { intent: "CHAT" };
}

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: INTENTS },
    contact: { type: ["string", "null"], description: "Recipient name/nickname exactly as the user said it (SEND_WHATSAPP only)" },
    message: { type: ["string", "null"], description: "Message body to send, rewritten in first person if needed (SEND_WHATSAPP only)" },
    reply: { type: ["string", "null"], description: "For CHAT: your spoken answer. Otherwise null." },
  },
  required: ["intent", "contact", "message", "reply"],
  additionalProperties: false,
};

export async function parseIntent(cfg: ResolvedConfig, text: string, contactNames: string[]): Promise<ParsedIntent & { parser: string }> {
  if (!llmEnabled(cfg)) return { ...parseIntentRules(text), parser: "rules" };
  try {
    const out = await completeJson<ParsedIntent>(cfg, {
      schemaName: "intent",
      schema: SCHEMA,
      maxTokens: 1024,
      system: `${personaPrompt(cfg)}

Classify the user's command into exactly one intent:
- SEND_WHATSAPP: send a WhatsApp/text message to someone. Extract contact + message.
- CHECK_EMAILS: asks which emails are important / what's in the inbox (read from cache).
- SCAN_INBOX: explicitly asks to scan/refresh/sync the inbox now.
- CALL_ME: wants an immediate phone call to their own phone.
- NEXT_MEETING: asks about / to be reminded of their next meeting.
- TODAY_MEETINGS: asks about today's schedule/calendar.
- DAILY_BRIEFING: wants a briefing / summary of the day.
- CHAT: anything else — answer it yourself in "reply".
Known contacts: ${contactNames.join(", ") || "(none)"}.`,
      user: text,
    });
    if (!INTENTS.includes(out.intent)) throw new Error(`bad intent ${out.intent}`);
    return { ...out, parser: cfg.llmProvider };
  } catch (e) {
    console.warn("[intent] LLM failed, using rules", e);
    return { ...parseIntentRules(text), parser: "rules-fallback" };
  }
}
