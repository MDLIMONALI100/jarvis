import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// One client per D1 binding instance (bindings are per isolate on Workers).
const clients = new WeakMap<object, PrismaClient>();

function client(): PrismaClient {
  const { env } = getCloudflareContext();
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('D1 binding "DB" is missing. Check d1_databases in wrangler.jsonc.');
  let c = clients.get(db);
  if (!c) {
    c = new PrismaClient({ adapter: new PrismaD1(db) });
    clients.set(db, c);
  }
  return c;
}

/**
 * Lazily resolves the request's D1-backed Prisma client, so modules can keep
 * importing `prisma` at the top level.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
