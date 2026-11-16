import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { z } from "zod";
import { sendPush } from "@/lib/services/push";
import { NOTIFICATION_TYPES, sendPreview } from "@/lib/services/notifications";

export const POST = handler("push:test", async (req: Request) => {
  const cfg = await getConfig();
  const { type } = z.object({ type: z.enum([...NOTIFICATION_TYPES, "all"]).optional() }).parse(await req.json().catch(() => ({})));
  if (type) {
    const r = await sendPreview(cfg, type);
    if (r.devices === 0) return json({ ok: false, message: "No devices subscribed yet. Enable notifications on your phone first." });
    return json({ ok: r.sent > 0, message: r.sent > 0 ? `Sent ${r.types} preview${r.types > 1 ? "s" : ""} to ${r.devices} device(s).` : "Push service rejected it. See Logs." });
  }
  const r = await sendPush(
    cfg,
    { title: cfg.assistantName, body: `Test notification, ${cfg.ownerName}. Alerts are working.`, url: "/", tag: "jarvis-test", urgent: true },
    "test",
  );
  if (r.devices === 0) return json({ ok: false, message: "No devices subscribed yet. Enable notifications on your phone first." });
  return json({ ok: r.sent > 0, message: r.sent > 0 ? `Sent to ${r.sent} of ${r.devices} device(s).` : `Failed: ${r.errors?.join("; ")}` });
});
