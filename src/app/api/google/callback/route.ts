import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { exchangeGoogleCode } from "@/lib/services/google";
import { logAction } from "@/lib/services/logger";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = process.env.APP_URL || url.origin;
  const jar = await cookies();
  const state = jar.get("jarvis_oauth_state")?.value;
  jar.delete("jarvis_oauth_state");
  const code = url.searchParams.get("code");
  if (!code || !state || state !== url.searchParams.get("state")) {
    return Response.redirect(new URL("/admin?tab=integrations&google=invalid-state", base));
  }
  try {
    const { email } = await exchangeGoogleCode(await getConfig(), code);
    await logAction({ type: "CONFIG", status: "SUCCESS", summary: `Google account connected${email ? `: ${email}` : ""}` });
    return Response.redirect(new URL("/admin?tab=integrations&google=connected", base));
  } catch (e) {
    await logAction({ type: "ERROR", status: "FAILED", summary: "Google OAuth failed", error: String(e) });
    return Response.redirect(new URL(`/admin?tab=integrations&google=error&msg=${encodeURIComponent(String(e).slice(0, 200))}`, base));
  }
}
