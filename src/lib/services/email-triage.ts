import "server-only";
import { prisma } from "../db";
import type { ResolvedConfig } from "../config";
import type { EmailCategory, RawEmail } from "../types";
import { completeJson, llmEnabled } from "./llm";
import { fetchUnreadEmails, googleLive } from "./google";
import { logAction } from "./logger";
import { placeCall } from "./voice";
import { sendWhatsApp } from "./whatsapp";
import { forwardToN8n, n8nTarget } from "./n8n";
import { isQuietHours } from "../time";
import { sendPush } from "./push";

export interface EmailScore {
  score: number;
  category: EmailCategory;
  summary: string;
  reason: string;
}

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

function categorize(score: number): EmailCategory {
  return score >= 8 ? "IMPORTANT" : score >= 5 ? "GOOD" : "IGNORE";
}

function isVip(cfg: ResolvedConfig, email: string, vipContacts: string[]) {
  const e = email.toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return [...list(cfg.vipSenders), ...vipContacts].some((v) => v === e || (v.startsWith("@") ? domain === v.slice(1) : domain === v));
}

/** Rule-based scorer: used in mock mode and as a fallback if the LLM fails. */
export function heuristicScore(cfg: ResolvedConfig, m: RawEmail, vipContacts: string[] = []): EmailScore {
  const text = `${m.subject} ${m.snippet} ${m.body}`.toLowerCase();
  let score = 4;
  const reasons: string[] = [];
  if (isVip(cfg, m.fromEmail, vipContacts)) {
    score += 3;
    reasons.push("VIP sender");
  }
  const hits = list(cfg.importantKeywords).filter((k) => text.includes(k));
  if (hits.length) {
    score += Math.min(3, hits.length * 1.5);
    reasons.push(`keywords: ${hits.join(", ")}`);
  }
  if (/\b(asap|today|immediately|urgent|failed|deadline)\b/.test(text)) {
    score += 1;
    reasons.push("time-sensitive");
  }
  const ignores = list(cfg.ignoreKeywords).filter((k) => text.includes(k));
  if (ignores.length) {
    score -= 3 + ignores.length;
    reasons.push(`low-value: ${ignores.join(", ")}`);
  }
  if (/no-?reply|newsletter|marketing|deals@/.test(m.fromEmail)) score -= 2;
  score = Math.max(1, Math.min(10, Math.round(score)));
  const firstSentence = (m.body || m.snippet).split(/(?<=[.!?])\s/)[0]?.slice(0, 160) ?? m.subject;
  return { score, category: categorize(score), summary: firstSentence, reason: reasons.join("; ") || "no strong signals" };
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "integer" },
          summary: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "score", "summary", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

async function llmScore(cfg: ResolvedConfig, emails: RawEmail[], vipContacts: string[]): Promise<Map<string, EmailScore>> {
  const system = `You triage email for ${cfg.ownerName}. Score each email's importance 1-10:
9-10 = urgent & needs action today (money at risk, boss/family emergency, hard deadline today)
7-8 = important, needs a response soon
5-6 = worth reading
1-4 = low value (newsletters, promotions, automated notifications, spam)
User's custom rules (follow these strictly):
${cfg.emailRules || "(none)"}
VIP senders (boost strongly): ${[...list(cfg.vipSenders), ...vipContacts].join(", ") || "(none)"}
Important keywords: ${cfg.importantKeywords || "(none)"}
Ignore keywords: ${cfg.ignoreKeywords || "(none)"}
For each email return a single-sentence summary (max 25 words, what it is + what action is needed) and a short reason for the score.`;
  const user = JSON.stringify(
    emails.map((e) => ({ id: e.id, from: `${e.fromName} <${e.fromEmail}>`, subject: e.subject, body: e.body.slice(0, 1500) || e.snippet })),
  );
  const out = await completeJson<{ results: { id: string; score: number; summary: string; reason: string }[] }>(cfg, {
    system,
    user,
    schema: SCORE_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "email_scores",
    maxTokens: 4096,
  });
  const map = new Map<string, EmailScore>();
  for (const r of out.results) {
    const score = Math.max(1, Math.min(10, Math.round(r.score)));
    map.set(r.id, { score, category: categorize(score), summary: r.summary, reason: r.reason });
  }
  return map;
}

/** Fetch unread mail, score new messages, persist, and alert on urgent ones. */
export async function syncEmails(cfg: ResolvedConfig, opts: { alert?: boolean } = {}) {
  const alert = opts.alert ?? true;
  const fetched = await fetchUnreadEmails(cfg, cfg.emailScanMaxResults || 20);
  const existing = new Set(
    (await prisma.emailLog.findMany({ where: { gmailId: { in: fetched.map((f) => f.id) } }, select: { gmailId: true } })).map((e) => e.gmailId),
  );
  const fresh = fetched.filter((f) => !existing.has(f.id));
  const vipContacts = (await prisma.contact.findMany({ where: { isVip: true, email: { not: null } }, select: { email: true } })).map((c) => c.email!.toLowerCase());

  let scores = new Map<string, EmailScore>();
  let scorer = "heuristic";
  if (fresh.length && llmEnabled(cfg)) {
    try {
      // Batch in groups of 10 to keep prompts small.
      for (let i = 0; i < fresh.length; i += 10) {
        const part = await llmScore(cfg, fresh.slice(i, i + 10), vipContacts);
        part.forEach((v, k) => scores.set(k, v));
      }
      scorer = cfg.llmProvider;
    } catch (e) {
      await logAction({ type: "ERROR", status: "FAILED", summary: "LLM email scoring failed — used rule-based fallback", error: String(e) });
      scores = new Map();
    }
  }

  const saved = [];
  for (const m of fresh) {
    const s = scores.get(m.id) ?? heuristicScore(cfg, m, vipContacts);
    saved.push(
      await prisma.emailLog.upsert({
        where: { gmailId: m.id },
        update: {},
        create: {
          gmailId: m.id,
          threadId: m.threadId,
          fromName: m.fromName,
          fromEmail: m.fromEmail,
          subject: m.subject,
          snippet: m.snippet,
          summary: s.summary,
          score: s.score,
          category: s.category,
          reason: s.reason,
          receivedAt: m.receivedAt,
          isMock: Boolean(m.isMock),
        },
      }),
    );
  }

  // Urgent alerts
  const alerts: string[] = [];
  const quiet = isQuietHours(cfg);
  if (alert && (cfg.urgentAlertChannel !== "none" || cfg.pushUrgentEmails) && (!quiet || cfg.quietAllowUrgent)) {
    const urgent = saved.filter((e) => e.score >= cfg.urgentThreshold && !e.alerted && !e.isMock);
    for (const e of urgent) {
      const text = `${cfg.ownerName}, urgent email from ${e.fromName}: ${e.subject}. ${e.summary}`;
      if (cfg.pushUrgentEmails) {
        await sendPush(
          cfg,
          { title: `🚨 ${e.fromName}: ${e.subject}`.slice(0, 120), body: e.summary, url: "/", tag: `email-${e.id}`, urgent: true },
          "urgent-email",
        ).catch(() => {});
      }
      if (n8nTarget(cfg, "emailTriage")) await forwardToN8n(cfg, "emailTriage", { email: e, message: text });
      if ((cfg.urgentAlertChannel === "whatsapp" || cfg.urgentAlertChannel === "both") && cfg.personalPhone) {
        await sendWhatsApp(cfg, cfg.personalPhone, `🚨 ${text}`, { reason: "urgent-email" });
      }
      if (cfg.urgentAlertChannel === "call" || cfg.urgentAlertChannel === "both") {
        await placeCall(cfg, text, { reason: "urgent-email" });
      }
      await prisma.emailLog.update({ where: { id: e.id }, data: { alerted: true } });
      alerts.push(e.id);
    }
  }

  const important = saved.filter((e) => e.category !== "IGNORE").length;
  await logAction({
    type: "EMAIL_SCAN",
    status: googleLive(cfg) ? "SUCCESS" : "MOCK",
    channel: googleLive(cfg) ? "native" : "mock",
    summary: `${googleLive(cfg) ? "" : "[Demo inbox] "}Scanned ${fetched.length} unread, ${fresh.length} new, ${important} worth attention, ${alerts.length} urgent alert(s)`,
    detail: { scorer, fetched: fetched.length, new: fresh.length, alerts },
  });
  return { fetched: fetched.length, new: fresh.length, important, alerts: alerts.length, scorer };
}

export async function priorityEmails(limit = 20) {
  const since = new Date(Date.now() - 48 * 60 * 60_000);
  return prisma.emailLog.findMany({
    where: { category: { in: ["IMPORTANT", "GOOD"] }, dismissed: false, receivedAt: { gte: since } },
    orderBy: [{ score: "desc" }, { receivedAt: "desc" }],
    take: limit,
  });
}
