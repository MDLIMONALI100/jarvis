import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResolvedConfig } from "../config";

export const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-opus-5-5",
  // Google aliases that track the current models. Flash-Lite answers in ~2s;
  // full Flash was 35-55s per call on the free tier, too slow for voice.
  gemini: "gemini-flash-lite-latest",
} as const;

export class LlmUnavailableError extends Error {}

type JsonSchema = Record<string, unknown>;

interface JsonRequest {
  system: string;
  user: string;
  schema: JsonSchema; // JSON Schema (object, additionalProperties:false)
  schemaName: string;
  maxTokens?: number;
}

function activeKey(cfg: ResolvedConfig): string {
  switch (cfg.llmProvider) {
    case "openai":
      return cfg.openaiApiKey;
    case "anthropic":
      return cfg.anthropicApiKey;
    case "gemini":
      return cfg.geminiApiKey;
    default:
      return "";
  }
}

export function llmEnabled(cfg: ResolvedConfig): boolean {
  return cfg.llmProvider !== "mock" && Boolean(activeKey(cfg));
}

function model(cfg: ResolvedConfig): string {
  if (cfg.llmModel) return cfg.llmModel;
  return DEFAULT_MODELS[cfg.llmProvider as keyof typeof DEFAULT_MODELS] ?? "";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Model did not return JSON");
  }
}

/** Ask the configured LLM for a JSON object matching `schema`. */
export async function completeJson<T>(cfg: ResolvedConfig, req: JsonRequest): Promise<T> {
  if (!llmEnabled(cfg)) throw new LlmUnavailableError("LLM not configured");
  const key = activeKey(cfg);
  const maxTokens = req.maxTokens ?? 2048;

  if (cfg.llmProvider === "anthropic") {
    const client = new Anthropic({ apiKey: key, timeout: 60_000 });
    const isOpus55 = model(cfg) === "claude-opus-5-5";
    const response = await client.beta.messages.create({
      model: model(cfg),
      max_tokens: maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      // Low effort: these are short classification / extraction calls.
      output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
      // Server-side refusal fallback (routes to a suitable model if declined).
      ...(isOpus55 ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (response.stop_reason === "refusal") throw new Error("Model declined the request");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return extractJson(text) as T;
  }

  if (cfg.llmProvider === "openai") {
    const client = new OpenAI({ apiKey: key, timeout: 60_000 });
    const res = await client.chat.completions.create({
      model: model(cfg),
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: req.schemaName, schema: req.schema, strict: true } },
    });
    return extractJson(res.choices[0]?.message?.content ?? "") as T;
  }

  if (cfg.llmProvider === "gemini") {
    const genAI = new GoogleGenerativeAI(key);
    const prompt = `${req.user}\n\nRespond with JSON matching this schema:\n${JSON.stringify(req.schema)}`;
    // The free tier sometimes answers 503 "high demand": retry, then fall back
    // to the other Flash alias.
    const primary = model(cfg);
    const fallback = primary === "gemini-flash-lite-latest" ? "gemini-flash-latest" : "gemini-flash-lite-latest";
    const attempts = [primary, primary, fallback];
    let lastErr: unknown;
    for (const [i, name] of attempts.entries()) {
      try {
        const m = genAI.getGenerativeModel(
          {
            model: name,
            systemInstruction: req.system,
            // Newer Flash models spend part of this budget on thinking.
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: Math.max(maxTokens, 8192) },
          },
          { timeout: 25_000 },
        );
        const res = await m.generateContent(prompt);
        return extractJson(res.response.text()) as T;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/\b(503|429|500)\b|overloaded|high demand|timed? ?out|abort/i.test(msg)) throw e;
        if (i < attempts.length - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
    throw lastErr;
  }

  throw new LlmUnavailableError(`Unknown provider ${cfg.llmProvider}`);
}

/** Plain-text completion (used for chat replies & briefings). */
export async function completeText(cfg: ResolvedConfig, system: string, user: string, maxTokens = 1024): Promise<string> {
  const out = await completeJson<{ text: string }>(cfg, {
    system,
    user,
    schemaName: "reply",
    maxTokens,
    schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  });
  return out.text;
}

export function personaPrompt(cfg: ResolvedConfig): string {
  const base =
    cfg.systemPrompt?.trim() ||
    `You are ${cfg.assistantName}, a calm, witty, impeccably polite British AI butler. Address the user as "${cfg.ownerName}". Be concise: answers are usually spoken aloud, so keep them to 1-3 short sentences unless asked for detail.`;
  return `${base}\nCurrent date/time: ${new Date().toISOString()} (user timezone: ${cfg.timezone}).`;
}
