import { clsx, type ClassValue } from "clsx";
export const cn = (...v: ClassValue[]) => clsx(v);

/** Normalise a phone number to E.164-ish (+digits). */
export function normalizePhone(p: string): string {
  const trimmed = p.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `+${trimmed.startsWith("00") ? digits.slice(2) : digits}`;
}

/**
 * Public base URL of the app (no trailing slash). APP_URL wins (set it for a
 * custom domain); otherwise the origin of the current request is used.
 */
export function appUrl(req?: Request): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  return "http://localhost:3000";
}
