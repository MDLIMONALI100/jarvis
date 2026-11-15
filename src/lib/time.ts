/** Minutes since midnight for `date` in IANA `timeZone`. */
export function minutesInZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

function parseHM(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return ((h || 0) % 24) * 60 + ((m || 0) % 60);
}

/** True when `now` falls in [start, end) — handles windows that wrap midnight. */
export function isQuietHours(cfg: { quietHoursEnabled: boolean; quietStart: string; quietEnd: string; timezone: string }, now = new Date()): boolean {
  if (!cfg.quietHoursEnabled) return false;
  const cur = minutesInZone(now, cfg.timezone);
  const s = parseHM(cfg.quietStart);
  const e = parseHM(cfg.quietEnd);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function formatTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

export function startOfDayInZone(now: Date, timeZone: string): { start: Date; end: Date } {
  const mins = minutesInZone(now, timeZone);
  const start = new Date(now.getTime() - mins * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds());
  return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
}
