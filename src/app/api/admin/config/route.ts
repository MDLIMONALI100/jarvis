import { z } from "zod";
import { getPublicConfig, updateConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { logAction } from "@/lib/services/logger";

export const GET = handler("admin/config", async () => json(await getPublicConfig()));

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const secret = z.string().max(4000).nullable().optional();
const Patch = z
  .object({
    ownerName: z.string().max(60),
    assistantName: z.string().max(60),
    timezone: z.string().max(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown IANA timezone"),
    systemPrompt: z.string().max(8000),
    llmProvider: z.enum(["mock", "openai", "anthropic", "gemini"]),
    llmModel: z.string().max(100),
    openaiApiKey: secret,
    anthropicApiKey: secret,
    geminiApiKey: secret,
    voiceProvider: z.enum(["mock", "vapi", "twilio"]),
    vapiApiKey: secret,
    vapiPublicKey: secret,
    vapiAssistantId: z.string().max(100).nullable(),
    vapiPhoneNumberId: z.string().max(100).nullable(),
    twilioAccountSid: z.string().max(100).nullable(),
    twilioAuthToken: secret,
    twilioFromNumber: z.string().max(40).nullable(),
    twilioVoice: z.string().max(60),
    whatsappProvider: z.enum(["mock", "cloud", "twilio"]),
    whatsappToken: secret,
    whatsappPhoneId: z.string().max(100).nullable(),
    whatsappVerifyToken: secret,
    whatsappAppSecret: secret,
    twilioWhatsappFrom: z.string().max(60).nullable(),
    googleClientId: z.string().max(300).nullable(),
    googleClientSecret: secret,
    googleRefreshToken: secret,
    googleCalendarId: z.string().max(200),
    n8nEnabled: z.boolean(),
    n8nWebhooks: z.record(z.enum(["whatsapp", "call", "emailTriage", "meetingAlert", "command"]), z.string().url().or(z.literal(""))),
    n8nSecret: secret,
    personalPhone: z.string().max(40),
    callLeadMinutes: z.number().int().min(1).max(120),
    callWindowMinutes: z.number().int().min(1).max(60),
    autoCallMeetings: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietStart: hhmm,
    quietEnd: hhmm,
    quietAllowUrgent: z.boolean(),
    urgentThreshold: z.number().int().min(1).max(10),
    urgentAlertChannel: z.enum(["none", "call", "whatsapp", "both"]),
    emailScanMaxResults: z.number().int().min(1).max(100),
    voiceName: z.string().max(200),
    voiceRate: z.number().min(0.5).max(2),
    voicePitch: z.number().min(0).max(2),
    voiceLang: z.string().max(20),
    speakResponses: z.boolean(),
    pushMeetings: z.boolean(),
    pushUrgentEmails: z.boolean(),
    emailRules: z.string().max(8000),
    vipSenders: z.string().max(8000),
    importantKeywords: z.string().max(4000),
    ignoreKeywords: z.string().max(4000),
  })
  .partial()
  .strict();

export const PUT = handler("admin/config:put", async (req: Request) => {
  const patch = Patch.parse(await req.json());
  await updateConfig(patch);
  await logAction({ type: "CONFIG", status: "SUCCESS", summary: `Settings updated: ${Object.keys(patch).join(", ")}` });
  return json(await getPublicConfig());
});

/** Disconnect Google: drops the refresh token. */
export const DELETE = handler("admin/config:delete", async (req: Request) => {
  const what = new URL(req.url).searchParams.get("what");
  if (what === "google") {
    await prisma.userConfig.update({ where: { id: "singleton" }, data: { googleRefreshToken: null, googleEmail: null } });
    await logAction({ type: "CONFIG", status: "SUCCESS", summary: "Google account disconnected" });
  }
  return json(await getPublicConfig());
});
