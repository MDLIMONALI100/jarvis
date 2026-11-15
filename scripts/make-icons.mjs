// Renders public/icons/icon.svg into the PNG sizes the PWA manifest + iOS need.
// Uses Playwright's Chromium (npx playwright install chromium if missing).
import { chromium } from "playwright";
import { readFileSync } from "fs";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const targets = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12 },
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setContent(
    `<html><body style="margin:0;background:#03070d;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${t.file}` });
  console.log("wrote", t.file);
}
await browser.close();
