import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Reachable without a session. Cron + webhook routes verify their own secrets.
const PUBLIC = [
  /^\/login$/,
  /^\/api\/auth\/login$/,
  /^\/api\/health$/,
  /^\/api\/cron\//,
  /^\/api\/whatsapp\/webhook$/,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
  /^\/offline\.html$/,
  /^\/icons\//,
  /^\/favicon\.ico$/,
];

// Automation endpoints also accept `Authorization: Bearer <CRON_SECRET>` (n8n, external cron).
const AUTOMATION = [/^\/api\/emails\/sync$/, /^\/api\/calendar\/check$/, /^\/api\/call\/trigger$/, /^\/api\/whatsapp\/send$/, /^\/api\/command$/];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const cron = process.env.CRON_SECRET;
  if (cron && AUTOMATION.some((r) => r.test(pathname)) && req.headers.get("authorization") === `Bearer ${cron}`) {
    return NextResponse.next();
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
