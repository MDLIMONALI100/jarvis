import "server-only";
import { prisma } from "../db";
import type { ActionStatus, ActionType, Channel } from "../types";

export async function logAction(entry: {
  type: ActionType;
  status: ActionStatus;
  summary: string;
  channel?: Channel;
  detail?: unknown;
  error?: string;
}) {
  return prisma.actionLog.create({
    data: {
      type: entry.type,
      status: entry.status,
      channel: entry.channel ?? "native",
      summary: entry.summary.slice(0, 500),
      detail: entry.detail === undefined ? null : JSON.stringify(entry.detail).slice(0, 8000),
      error: entry.error?.slice(0, 2000) ?? null,
    },
  });
}
