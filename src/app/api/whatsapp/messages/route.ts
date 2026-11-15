import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";

export const GET = handler("whatsapp/messages", async () =>
  json({
    messages: await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { contact: { select: { name: true } } },
    }),
  }),
);
