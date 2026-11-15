import { z } from "zod";
import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { getVapidKeys } from "@/lib/services/push";
import { logAction } from "@/lib/services/logger";

/** Public VAPID key (needed by the browser to subscribe) + subscribed devices. */
export const GET = handler("push:get", async () => {
  const cfg = await getConfig();
  const { publicKey } = await getVapidKeys(cfg);
  const devices = await prisma.pushSubscription.findMany({
    select: { id: true, label: true, createdAt: true, lastSuccessAt: true },
    orderBy: { createdAt: "desc" },
  });
  return json({ publicKey, devices, pushMeetings: cfg.pushMeetings, pushUrgentEmails: cfg.pushUrgentEmails });
});

const Subscription = z.object({
  endpoint: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "endpoint must be https"),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
  label: z.string().max(100).optional(),
});

export const POST = handler("push:subscribe", async (req: Request) => {
  const sub = Subscription.parse(await req.json());
  const data = { p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: sub.label ?? "", failures: 0 };
  await prisma.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: { endpoint: sub.endpoint, ...data }, update: data });
  await logAction({ type: "CONFIG", status: "SUCCESS", summary: `Push notifications enabled on ${sub.label || "a device"}` });
  return json({ ok: true, devices: await prisma.pushSubscription.count() });
});

export const DELETE = handler("push:unsubscribe", async (req: Request) => {
  const body = z.object({ endpoint: z.string().max(2000).optional(), id: z.string().max(50).optional() }).parse(await req.json());
  if (body.endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
  if (body.id) await prisma.pushSubscription.deleteMany({ where: { id: body.id } });
  return json({ ok: true, devices: await prisma.pushSubscription.count() });
});
