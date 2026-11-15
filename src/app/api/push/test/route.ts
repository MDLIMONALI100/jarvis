import { getConfig } from "@/lib/config";
import { handler, json } from "@/lib/http";
import { sendPush } from "@/lib/services/push";

export const POST = handler("push:test", async () => {
  const cfg = await getConfig();
  const r = await sendPush(
    cfg,
    { title: cfg.assistantName, body: `Test notification, ${cfg.ownerName}. Alerts are working.`, url: "/", tag: "jarvis-test", urgent: true },
    "test",
  );
  if (r.devices === 0) return json({ ok: false, message: "No devices subscribed yet. Enable notifications on your phone first." });
  return json({ ok: r.sent > 0, message: r.sent > 0 ? `Sent to ${r.sent} of ${r.devices} device(s).` : `Failed: ${r.errors?.join("; ")}` });
});
