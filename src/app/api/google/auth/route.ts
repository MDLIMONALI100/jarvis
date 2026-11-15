import { appUrl } from "@/lib/utils";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getConfig } from "@/lib/config";
import { googleAuthUrl } from "@/lib/services/google";

export async function GET(req: Request) {
  const cfg = await getConfig();
  if (!cfg.googleClientId || !cfg.googleClientSecret) {
    return Response.redirect(new URL("/admin?tab=integrations&google=missing-credentials", appUrl(req)));
  }
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("jarvis_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/", secure: process.env.NODE_ENV === "production" });
  return Response.redirect(googleAuthUrl(cfg, state, appUrl(req)));
}
