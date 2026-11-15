export interface EmailItem {
  id: string;
  gmailId: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  summary: string;
  score: number;
  category: "IMPORTANT" | "GOOD" | "IGNORE";
  receivedAt: string;
  isMock: boolean;
}
export interface MeetingItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  meetLink: string | null;
  autoCall: boolean;
  callTriggered: boolean;
  isMock: boolean;
}
export interface MessageItem {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  phone: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
  contact: { name: string } | null;
}
export interface ActivityItem {
  id: string;
  type: string;
  status: string;
  channel: string;
  summary: string;
  createdAt: string;
}
export interface Dashboard {
  owner: string;
  assistant: string;
  timezone: string;
  callLeadMinutes: number;
  voice: { name: string; rate: number; pitch: number; lang: string; speak: boolean };
  status: { llm: boolean; voice: boolean; whatsapp: boolean; google: boolean; n8n: boolean; phone: boolean };
  emails: EmailItem[];
  meetings: MeetingItem[];
  messages: MessageItem[];
  activity: ActivityItem[];
}
export interface ChatEntry {
  id: string;
  role: "user" | "jarvis";
  text: string;
  intent?: string;
  success?: boolean;
}
