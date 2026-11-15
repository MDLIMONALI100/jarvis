import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logAction } from "./services/logger";

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Wraps a route handler: zod errors -> 400, everything else -> 500 + audit log. */
export function handler<A extends unknown[]>(name: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return json({ error: "Invalid request", issues: err.issues }, 400);
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${name}]`, err);
      await logAction({ type: "ERROR", status: "FAILED", summary: `${name} failed`, error: message }).catch(() => {});
      return json({ error: message }, 500);
    }
  };
}

/** Cron/automation auth: `Authorization: Bearer <CRON_SECRET>` or `?key=`. */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}
