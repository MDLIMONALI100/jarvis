import { clsx, type ClassValue } from "clsx";
export const cn = (...v: ClassValue[]) => clsx(v);

/** Normalise a phone number to E.164-ish (+digits). */
export function normalizePhone(p: string): string {
  const trimmed = p.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `+${trimmed.startsWith("00") ? digits.slice(2) : digits}`;
}
