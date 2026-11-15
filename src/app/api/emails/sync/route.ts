import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { syncEmails } from "@/lib/services/email-triage";

export const maxDuration = 60;
export const POST = handler("emails/sync", async () => json(await syncEmails(await getConfig())));
