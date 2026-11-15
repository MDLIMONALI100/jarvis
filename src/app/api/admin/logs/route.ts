import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handler, json } from "@/lib/http";

export const GET = handler("admin/logs", async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim();
  const type = p.get("type");
  const status = p.get("status");
  const page = Math.max(1, Number(p.get("page") ?? 1));
  const size = Math.min(100, Math.max(10, Number(p.get("size") ?? 25)));
  const where: Prisma.ActionLogWhereInput = {
    ...(type && type !== "ALL" ? { type } : {}),
    ...(status && status !== "ALL" ? { status } : {}),
    ...(q ? { OR: [{ summary: { contains: q } }, { error: { contains: q } }, { detail: { contains: q } }] } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.actionLog.count({ where }),
    prisma.actionLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size }),
  ]);
  return json({ logs, total, page, size });
});

/** Purge logs older than N days (default 90). */
export const DELETE = handler("admin/logs:purge", async (req: Request) => {
  const days = Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 90));
  const { count } = await prisma.actionLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86_400_000) } } });
  return json({ deleted: count });
});
