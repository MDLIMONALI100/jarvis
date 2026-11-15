export type Cfg = Record<string, unknown> & {
  ownerName: string;
  assistantName: string;
  timezone: string;
  systemPrompt: string;
  llmProvider: string;
  llmModel: string;
  voiceProvider: string;
  whatsappProvider: string;
  n8nEnabled: boolean;
  n8nWebhooks: Record<string, string>;
  personalPhone: string;
  callLeadMinutes: number;
  callWindowMinutes: number;
  autoCallMeetings: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  quietAllowUrgent: boolean;
  urgentThreshold: number;
  urgentAlertChannel: string;
  emailScanMaxResults: number;
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
  voiceLang: string;
  speakResponses: boolean;
  emailRules: string;
  vipSenders: string;
  importantKeywords: string;
  ignoreKeywords: string;
  googleEmail: string | null;
  googleCalendarId: string;
};

export interface Status {
  llm: boolean;
  voice: boolean;
  whatsapp: boolean;
  google: boolean;
  googleCredentials: boolean;
  n8n: boolean;
  phone: boolean;
}

export interface AdminCtx {
  cfg: Cfg;
  secretsSet: Record<string, boolean>;
  status: Status;
  draft: Record<string, unknown>;
  get: <T = string>(k: string) => T;
  set: (k: string, v: unknown) => void;
  reload: () => Promise<void>;
  replace: (d: { config: Cfg; secretsSet: Record<string, boolean>; status: Status }) => void;
}
