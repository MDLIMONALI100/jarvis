import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { priorityEmails } from "@/lib/services/email-triage";

export const GET = handler("emails", async (req: Request) => {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const emails = all ? await prisma.emailLog.findMany({ orderBy: { receivedAt: "desc" }, take: 100 }) : await priorityEmails(20);
  return json({ emails });
});
