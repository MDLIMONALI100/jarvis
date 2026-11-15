import "server-only";
import type { Contact } from "@prisma/client";
import { prisma } from "../db";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  // Dice coefficient on bigrams — robust to small speech-recognition errors.
  const grams = (s: string) => {
    const g = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) g.set(s.slice(i, i + 2), (g.get(s.slice(i, i + 2)) ?? 0) + 1);
    return g;
  };
  const ga = grams(a);
  const gb = grams(b);
  let overlap = 0;
  for (const [k, v] of ga) overlap += Math.min(v, gb.get(k) ?? 0);
  return (2 * overlap) / (Math.max(1, a.length - 1) + Math.max(1, b.length - 1));
}

/** Resolve "mom", "my boss", "John" etc. to a stored contact. */
export async function resolveContact(query: string): Promise<{ contact: Contact | null; candidates: Contact[] }> {
  const q = norm(query.replace(/^(my|the)\s+/i, ""));
  if (!q) return { contact: null, candidates: [] };
  const all = await prisma.contact.findMany();
  const scored = all
    .map((c) => {
      const names = [c.name, ...c.nicknames.split(",")].map(norm).filter(Boolean);
      let best = 0;
      for (const n of names) {
        if (n === q) best = Math.max(best, 1);
        else if (n.split(" ")[0] === q || q.split(" ")[0] === n) best = Math.max(best, 0.9);
        else best = Math.max(best, similarity(n, q));
      }
      return { c, best };
    })
    .sort((a, b) => b.best - a.best);
  const top = scored[0];
  if (top && top.best >= 0.72 && (scored.length < 2 || top.best - scored[1].best > 0.05 || top.best === 1)) {
    return { contact: top.c, candidates: [] };
  }
  return { contact: null, candidates: scored.filter((s) => s.best >= 0.5).slice(0, 3).map((s) => s.c) };
}
