import { cookies } from "next/headers";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { handler, json } from "@/lib/http";
import { logAction } from "@/lib/services/logger";

// Simple per-IP brute-force guard (per server instance).
const attempts = new Map<string, { n: number; until: number }>();

export const POST = handler("auth/login", async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const a = attempts.get(ip);
  if (a && a.until > Date.now() && a.n >= 5) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil((a.until - Date.now()) / 1000)}s.` }, 429);
  }
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(await req.json());
  const expected = process.env.JARVIS_PASSWORD;
  if (!expected || expected.length < 4) return json({ error: "JARVIS_PASSWORD is not configured on the server." }, 500);

  if (!safeEqual(password, expected)) {
    const cur = a && a.until > Date.now() ? a : { n: 0, until: 0 };
    attempts.set(ip, { n: cur.n + 1, until: Date.now() + 2 ** Math.min(cur.n, 8) * 1000 * 15 });
    await logAction({ type: "AUTH", status: "FAILED", summary: `Failed login from ${ip}` });
    return json({ error: "Access denied." }, 401);
  }
  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  await logAction({ type: "AUTH", status: "SUCCESS", summary: `Login from ${ip}` });
  return json({ ok: true });
});
