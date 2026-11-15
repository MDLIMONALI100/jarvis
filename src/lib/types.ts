export type LlmProvider = "mock" | "openai" | "anthropic" | "gemini";
export type VoiceProvider = "mock" | "vapi" | "twilio";
export type WhatsAppProvider = "mock" | "cloud" | "twilio";
export type EmailCategory = "IMPORTANT" | "GOOD" | "IGNORE";
export type ActionType =
  | "COMMAND"
  | "WHATSAPP_SENT"
  | "WHATSAPP_RECEIVED"
  | "CALL_PLACED"
  | "EMAIL_SCAN"
  | "CALENDAR_CHECK"
  | "CONFIG"
  | "AUTH"
  | "ERROR";
export type ActionStatus = "SUCCESS" | "FAILED" | "MOCK" | "SKIPPED";
export type Channel = "native" | "n8n" | "mock";
export type UrgentChannel = "none" | "call" | "whatsapp" | "both";

/** Result returned by every outbound integration (call, WhatsApp, n8n). */
export interface ServiceResult {
  ok: boolean;
  channel: Channel;
  ref?: string;
  error?: string;
  detail?: unknown;
}

export type N8nAction = "whatsapp" | "call" | "emailTriage" | "meetingAlert" | "command";

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  meetLink?: string;
  isMock?: boolean;
}

export interface RawEmail {
  id: string;
  threadId?: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  body: string;
  receivedAt: Date;
  isMock?: boolean;
}

export type Intent =
  | "SEND_WHATSAPP"
  | "CHECK_EMAILS"
  | "SCAN_INBOX"
  | "CALL_ME"
  | "NEXT_MEETING"
  | "TODAY_MEETINGS"
  | "DAILY_BRIEFING"
  | "CHAT";

export interface ParsedIntent {
  intent: Intent;
  contact?: string | null;
  message?: string | null;
  reply?: string | null;
}

export interface CommandResponse {
  reply: string;
  intent: Intent;
  success: boolean;
  data?: unknown;
}
