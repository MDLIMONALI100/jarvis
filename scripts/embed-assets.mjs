// Embeds .open-next/assets into the Worker bundle so a deploy needs only the
// Worker script upload (no separate static-assets upload step).
// Text files become Wrangler "Text" modules (*.txt), binaries "Data" (*.bin).
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { join, relative, extname } from "node:path";

const SRC = ".open-next/assets";
const OUT = ".open-next/embedded";
const TEXT = new Set([".js", ".mjs", ".css", ".html", ".svg", ".json", ".txt", ".webmanifest", ".map", ".xml", ""]);
const TYPES = {
  ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json", ".xml": "application/xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".gif": "image/gif",
  ".woff": "font/woff", ".woff2": "font/woff2", "": "text/plain; charset=utf-8",
};

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const imports = [];
const entries = [];
walk(SRC).forEach((file, i) => {
  const rel = "/" + relative(SRC, file).split("\\").join("/");
  const ext = extname(file).toLowerCase();
  const isText = TEXT.has(ext);
  const name = `a${i}${isText ? ".txt" : ".bin"}`;
  copyFileSync(file, join(OUT, name));
  imports.push(`import a${i} from "./embedded/${name}";`);
  entries.push(`  ${JSON.stringify(rel)}: { body: a${i}, type: ${JSON.stringify(TYPES[ext] ?? "application/octet-stream")} },`);
});
writeFileSync(
  ".open-next/embedded-assets.mjs",
  `${imports.join("\n")}\nexport default {\n${entries.join("\n")}\n};\n`,
);
console.log(`Embedded ${entries.length} static assets into the Worker bundle.`);
