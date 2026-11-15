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
 * Public base URL of the app (no trailing slash). APP_URL wins; on Vercel it
 * falls back to the production domain Vercel provides automatically.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
