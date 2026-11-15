import "server-only";
import type { UserConfig } from "@prisma/client";
import { prisma } from "./db";
import { decrypt, encrypt, mask } from "./crypto";
import type { N8nAction } from "./types";

/** Columns that are stored encrypted and never returned to the browser in clear text. */
export const SECRET_FIELDS = [
  "openaiApiKey",
  "anthropicApiKey",
  "geminiApiKey",
  "vapiApiKey",
  "vapiPublicKey",
  "twilioAuthToken",
  "whatsappToken",
  "whatsappAppSecret",
  "whatsappVerifyToken",
  "googleClientSecret",
  "googleRefreshToken",
  "n8nSecret",
] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];

/** Env fallbacks so keys can live in .env instead of the DB if preferred. */
const ENV_FALLBACK: Partial<Record<keyof UserConfig, string>> = {
  openaiApiKey: "OPENAI_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  geminiApiKey: "GEMINI_API_KEY",
  vapiApiKey: "VAPI_API_KEY",
  twilioAccountSid: "TWILIO_ACCOUNT_SID",
  twilioAuthToken: "TWILIO_AUTH_TOKEN",
  whatsappToken: "WHATSAPP_TOKEN",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
};

/** Secrets are always decrypted strings ("" when unset). */
export type ResolvedConfig = Omit<UserConfig, "n8nWebhooks" | SecretField> & {
  [K in SecretField]: string;
} & {
  n8nWebhooks: Partial<Record<N8nAction, string>>;
};

export async function getRawConfig(): Promise<UserConfig> {
  return prisma.userConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

/** Decrypted config for server-side use only. */
export async function getConfig(): Promise<ResolvedConfig> {
  const raw = await getRawConfig();
  const out: Record<string, unknown> = { ...raw };
  for (const f of SECRET_FIELDS) out[f] = decrypt(raw[f]);
  for (const [field, envName] of Object.entries(ENV_FALLBACK)) {
    if (!out[field] && envName && process.env[envName]) out[field] = process.env[envName];
  }
  let hooks: Partial<Record<N8nAction, string>> = {};
  try {
    hooks = JSON.parse(raw.n8nWebhooks || "{}");
  } catch {}
  out.n8nWebhooks = hooks;
  return out as ResolvedConfig;
}

/** Browser-safe view: secrets replaced by masked previews + "set" flags. */
export async function getPublicConfig() {
  const cfg = await getConfig();
  const pub: Record<string, unknown> = { ...cfg };
  const secretsSet: Record<string, boolean> = {};
  for (const f of SECRET_FIELDS) {
    const v = cfg[f] as string;
    secretsSet[f] = Boolean(v);
    pub[f] = v ? mask(v) : "";
  }
  return { config: pub, secretsSet, status: integrationStatus(cfg) };
}

/**
 * Apply a partial update. Secret fields: "" leaves the value unchanged,
 * null clears it, any other string is encrypted and stored.
 */
export async function updateConfig(patch: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    if ((SECRET_FIELDS as readonly string[]).includes(k)) {
      if (v === null) data[k] = null;
      else if (typeof v === "string" && v.trim() !== "" && !v.includes("•")) data[k] = encrypt(v.trim());
      continue;
    }
    if (k === "n8nWebhooks") {
      data[k] = JSON.stringify(v ?? {});
      continue;
    }
    data[k] = v;
  }
  await getRawConfig();
  return prisma.userConfig.update({ where: { id: "singleton" }, data });
}

export function integrationStatus(cfg: ResolvedConfig) {
  const llmKey =
    cfg.llmProvider === "openai"
      ? cfg.openaiApiKey
      : cfg.llmProvider === "anthropic"
        ? cfg.anthropicApiKey
        : cfg.llmProvider === "gemini"
          ? cfg.geminiApiKey
          : "";
  const voiceLive =
    cfg.voiceProvider === "vapi"
      ? Boolean(cfg.vapiApiKey && cfg.vapiPhoneNumberId)
      : cfg.voiceProvider === "twilio"
        ? Boolean(cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFromNumber)
        : false;
  const waLive =
    cfg.whatsappProvider === "cloud"
      ? Boolean(cfg.whatsappToken && cfg.whatsappPhoneId)
      : cfg.whatsappProvider === "twilio"
        ? Boolean(cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioWhatsappFrom)
        : false;
  return {
    llm: cfg.llmProvider !== "mock" && Boolean(llmKey),
    voice: voiceLive,
    whatsapp: waLive,
    google: Boolean(cfg.googleClientId && cfg.googleClientSecret && cfg.googleRefreshToken),
    googleCredentials: Boolean(cfg.googleClientId && cfg.googleClientSecret),
    n8n: cfg.n8nEnabled && Object.values(cfg.n8nWebhooks).some(Boolean),
    phone: Boolean(cfg.personalPhone),
  };
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>;
