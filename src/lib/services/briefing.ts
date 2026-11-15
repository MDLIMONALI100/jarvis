import "server-only";
import type { ResolvedConfig } from "../config";
import { formatTime } from "../time";
import { completeText, llmEnabled, personaPrompt } from "./llm";
import { priorityEmails } from "./email-triage";
import { upcomingMeetings } from "./meetings";

export async function dailyBriefing(cfg: ResolvedConfig) {
  const [meetings, emails] = await Promise.all([upcomingMeetings(cfg), priorityEmails(10)]);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const facts = {
    meetings: meetings.map((m) => ({ title: m.title, time: formatTime(m.startTime, cfg.timezone) })),
    emails: emails.map((e) => ({ from: e.fromName, subject: e.subject, score: e.score, summary: e.summary })),
  };

  if (llmEnabled(cfg)) {
    try {
      const text = await completeText(
        cfg,
        personaPrompt(cfg),
        `Give me a spoken daily briefing (max ~90 words). Start with "${greeting}, ${cfg.ownerName}." Cover meetings in order, then the most important emails (score >= 8 first). Data:\n${JSON.stringify(facts)}`,
      );
      return { text, ...facts };
    } catch (e) {
      console.warn("[briefing] LLM failed", e);
    }
  }

  const parts = [`${greeting}, ${cfg.ownerName}.`];
  if (facts.meetings.length) {
    parts.push(
      `You have ${facts.meetings.length} meeting${facts.meetings.length > 1 ? "s" : ""} remaining today: ${facts.meetings
        .slice(0, 4)
        .map((m) => `${m.title} at ${m.time}`)
        .join("; ")}.`,
    );
  } else parts.push("Your calendar is clear for the rest of the day.");
  const urgent = facts.emails.filter((e) => e.score >= 8);
  if (urgent.length) parts.push(`${urgent.length} email${urgent.length > 1 ? "s need" : " needs"} your attention, most notably from ${urgent[0].from}: ${urgent[0].subject}.`);
  else if (facts.emails.length) parts.push(`There are ${facts.emails.length} worthwhile emails, nothing urgent.`);
  else parts.push("Nothing pressing in your inbox.");
  return { text: parts.join(" "), ...facts };
}
