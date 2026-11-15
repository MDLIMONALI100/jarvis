import "server-only";
import { prisma } from "../db";
import { getConfig } from "../config";
import type { CommandResponse } from "../types";
import { formatTime } from "../time";
import { parseIntent } from "./intent";
import { resolveContact } from "./contacts";
import { sendWhatsApp } from "./whatsapp";
import { placeCall } from "./voice";
import { priorityEmails, syncEmails } from "./email-triage";
import { upcomingMeetings } from "./meetings";
import { dailyBriefing } from "./briefing";
import { completeText, llmEnabled, personaPrompt } from "./llm";
import { logAction } from "./logger";
import { forwardToN8n, n8nTarget } from "./n8n";

function minutesUntil(d: Date) {
  return Math.round((d.getTime() - Date.now()) / 60_000);
}

function humanDelta(mins: number) {
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `in ${h} hour${h > 1 ? "s" : ""}${m ? ` ${m} minutes` : ""}`;
}

/** Natural-language command → intent → action → spoken reply. */
export async function executeCommand(text: string): Promise<CommandResponse> {
  const cfg = await getConfig();
  const contacts = await prisma.contact.findMany({ select: { name: true, nicknames: true } });
  const names = contacts.flatMap((c) => [c.name, ...c.nicknames.split(",").map((n) => n.trim())]).filter(Boolean);
  const parsed = await parseIntent(cfg, text, names);
  const o = cfg.ownerName;
  let res: CommandResponse;

  // Optional: hand the whole command to n8n (it may reply with { reply }).
  if (n8nTarget(cfg, "command")) {
    const fwd = await forwardToN8n(cfg, "command", { text, parsed });
    const reply = (fwd.detail as { reply?: string } | undefined)?.reply;
    if (fwd.ok && reply) {
      await logAction({ type: "COMMAND", status: "SUCCESS", channel: "n8n", summary: `"${text}" → n8n`, detail: { parsed } });
      return { reply, intent: parsed.intent, success: true, data: fwd.detail };
    }
  }

  switch (parsed.intent) {
    case "SEND_WHATSAPP": {
      if (!parsed.contact || !parsed.message) {
        res = { reply: `To whom shall I send it, ${o}, and what should it say?`, intent: parsed.intent, success: false };
        break;
      }
      const { contact, candidates } = await resolveContact(parsed.contact);
      if (!contact) {
        res = {
          reply: candidates.length
            ? `I'm not certain who "${parsed.contact}" is. Did you mean ${candidates.map((c) => c.name).join(" or ")}?`
            : `I couldn't find "${parsed.contact}" in your contacts, ${o}. You can add them in the admin panel.`,
          intent: parsed.intent,
          success: false,
          data: { candidates: candidates.map((c) => c.name) },
        };
        break;
      }
      const sent = await sendWhatsApp(cfg, contact.phone, parsed.message, { contactId: contact.id, contactName: contact.name, reason: "voice-command" });
      res = sent.ok
        ? {
            reply: `${sent.channel === "mock" ? "Simulated: " : ""}Message sent to ${contact.name}, ${o}.`,
            intent: parsed.intent,
            success: true,
            data: { to: contact.name, message: parsed.message, channel: sent.channel },
          }
        : { reply: `I'm afraid the message to ${contact.name} failed: ${sent.error}`, intent: parsed.intent, success: false };
      break;
    }

    case "CALL_ME": {
      const call = await placeCall(cfg, `Hello ${o}, this is ${cfg.assistantName}. You asked me to call you. How may I help?`, { reason: "voice-command" });
      res = call.ok
        ? { reply: call.channel === "mock" ? `Simulated call placed, ${o}. Configure Vapi or Twilio to make it ring for real.` : `Calling your phone now, ${o}.`, intent: parsed.intent, success: true }
        : { reply: `I couldn't place the call: ${call.error}`, intent: parsed.intent, success: false };
      break;
    }

    case "SCAN_INBOX":
    case "CHECK_EMAILS": {
      if (parsed.intent === "SCAN_INBOX" || (await prisma.emailLog.count()) === 0) await syncEmails(cfg);
      const emails = await priorityEmails(5);
      const urgent = emails.filter((e) => e.category === "IMPORTANT");
      res = {
        reply: emails.length
          ? `You have ${urgent.length} important and ${emails.length - urgent.length} noteworthy email${emails.length - urgent.length === 1 ? "" : "s"}. ${emails
              .slice(0, 3)
              .map((e) => `From ${e.fromName}: ${e.summary}`)
              .join(" ")}`
          : `Nothing important in your inbox right now, ${o}.`,
        intent: parsed.intent,
        success: true,
        data: { emails },
      };
      break;
    }

    case "NEXT_MEETING": {
      const next = (await upcomingMeetings(cfg)).find((m) => m.startTime.getTime() > Date.now());
      res = next
        ? {
            reply: `Your next meeting is ${next.title} at ${formatTime(next.startTime, cfg.timezone)}, ${humanDelta(minutesUntil(next.startTime))}.${next.autoCall ? ` I'll call you ${cfg.callLeadMinutes} minutes before.` : ""}`,
            intent: parsed.intent,
            success: true,
            data: { meeting: next },
          }
        : { reply: `You have no more meetings today, ${o}.`, intent: parsed.intent, success: true };
      break;
    }

    case "TODAY_MEETINGS": {
      const list = await upcomingMeetings(cfg);
      res = {
        reply: list.length
          ? `You have ${list.length} meeting${list.length > 1 ? "s" : ""} coming up: ${list.map((m) => `${m.title} at ${formatTime(m.startTime, cfg.timezone)}`).join("; ")}.`
          : `Your calendar is clear, ${o}.`,
        intent: parsed.intent,
        success: true,
        data: { meetings: list },
      };
      break;
    }

    case "DAILY_BRIEFING": {
      const b = await dailyBriefing(cfg);
      res = { reply: b.text, intent: parsed.intent, success: true, data: b };
      break;
    }

    default: {
      let reply = parsed.reply ?? "";
      if (!reply && llmEnabled(cfg)) reply = await completeText(cfg, personaPrompt(cfg), text).catch(() => "");
      if (!reply)
        reply = `I'm running in offline mode, ${o}, so I can only handle core commands: send WhatsApp messages, check emails, call you, meetings and briefings. Add an AI key in the admin panel for open conversation.`;
      res = { reply, intent: "CHAT", success: true };
    }
  }

  await logAction({
    type: "COMMAND",
    status: res.success ? "SUCCESS" : "FAILED",
    summary: `"${text.slice(0, 140)}" → ${res.intent}`,
    detail: { parser: parsed.parser, parsed, reply: res.reply },
  });
  return res;
}
