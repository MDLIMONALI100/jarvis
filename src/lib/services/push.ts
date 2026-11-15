import "server-only";
import { prisma } from "../db";
import { decrypt, encrypt } from "../crypto";
import type { ResolvedConfig } from "../config";
import { logAction } from "./logger";

/**
 * Web Push without third-party services: VAPID (RFC 8292) authentication and
 * aes128gcm payload encryption (RFC 8291), implemented with Web Crypto so it
 * runs on Cloudflare Workers. Free and unlimited; the browser vendor's push
 * service (FCM, Apple, Mozilla) delivers to the device.
 */

export interface PushMessage {
  title: string;
  body: string;
  url?: string; // opened when the notification is tapped
  tag?: string; // same tag replaces an earlier notification
  urgent?: boolean; // keeps the notification on screen until dismissed
}

const enc = new TextEncoder();
type B = Uint8Array<ArrayBuffer>;

function b64url(bytes: ArrayBuffer | B): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): B {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: B[]): B {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: B, ikm: B, info: B, bytes: number): Promise<B> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

// ── VAPID keys ───────────────────────────────────────────────────────────────

interface VapidKeys {
  publicKey: string; // base64url, uncompressed P-256 point (65 bytes)
  privateJwk: JsonWebKey;
}

/** Returns the app's VAPID key pair, generating and storing it on first use. */
export async function getVapidKeys(cfg?: Pick<ResolvedConfig, "vapidPublicKey" | "vapidPrivateKey">): Promise<VapidKeys> {
  const row = cfg ?? (await prisma.userConfig.findUnique({ where: { id: "singleton" }, select: { vapidPublicKey: true, vapidPrivateKey: true } }));
  const priv = row?.vapidPrivateKey ? decrypt(row.vapidPrivateKey) || row.vapidPrivateKey : "";
  if (row?.vapidPublicKey && priv.startsWith("{")) {
    return { publicKey: row.vapidPublicKey, privateJwk: JSON.parse(priv) };
  }
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const publicKey = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
  const privateJwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  await prisma.userConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", vapidPublicKey: publicKey, vapidPrivateKey: encrypt(JSON.stringify(privateJwk)) },
    update: { vapidPublicKey: publicKey, vapidPrivateKey: encrypt(JSON.stringify(privateJwk)) },
  });
  return { publicKey, privateJwk };
}

export async function vapidHeader(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const key = await crypto.subtle.importKey("jwk", keys.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  // Web Crypto returns the raw r||s signature, exactly what JWS ES256 expects.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${keys.publicKey}`;
}

// ── Payload encryption (RFC 8291, aes128gcm) ─────────────────────────────────

export async function encryptPayload(payload: B, uaPublicB64: string, authSecretB64: string): Promise<B> {
  const uaPublic = fromB64url(uaPublicB64);
  const authSecret = fromB64url(authSecretB64);

  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = concat(payload, new Uint8Array([2])); // 0x02 = last (and only) record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// ── Sending ──────────────────────────────────────────────────────────────────

type Sub = { id: string; endpoint: string; p256dh: string; auth: string; failures: number };

async function sendOne(sub: Sub, msg: PushMessage, keys: VapidKeys, subject: string): Promise<{ ok: boolean; status: number; gone: boolean; reason: string }> {
  const body = await encryptPayload(enc.encode(JSON.stringify(msg)), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, keys, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: msg.urgent ? "3600" : "86400",
      Urgency: msg.urgent ? "high" : "normal",
      ...(msg.tag ? { Topic: msg.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  // Push services explain rejections in the body (e.g. Apple: {"reason":"BadJwtToken"}).
  const reason = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 200);
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, reason };
}

/**
 * Sends a notification to every subscribed device. Expired subscriptions are
 * removed automatically. Returns how many devices accepted it.
 */
// VAPID "sub" claim: a contact URL for the push services. Apple's push service
// rejected a generic mailto: here (403 BadJwtToken) but accepts the app's own
// https URL, so set APP_URL in production.
const vapidSubject = () => process.env.APP_URL || "mailto:jarvis-push@users.noreply.github.com";

export async function sendPush(cfg: ResolvedConfig, msg: PushMessage, reason = "manual") {
  const subject = vapidSubject();
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return { sent: 0, devices: 0 };
  const keys = await getVapidKeys(cfg);
  let sent = 0;
  const errors: string[] = [];
  for (const sub of subs) {
    try {
      const r = await sendOne(sub, msg, keys, subject);
      if (r.ok) {
        sent++;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failures: 0, lastSuccessAt: new Date() } });
      } else if (r.gone || sub.failures >= 49) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        errors.push(`${r.status} (device unsubscribed, removed)`);
      } else {
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { failures: { increment: 1 } } });
        errors.push(`${new URL(sub.endpoint).host} responded ${r.status}${r.reason ? `: ${r.reason}` : ""}`);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  await logAction({
    type: "PUSH_SENT",
    status: sent > 0 ? "SUCCESS" : "FAILED",
    summary: `Push "${msg.title}" → ${sent}/${subs.length} device(s)`,
    detail: { reason, body: msg.body, errors },
    error: errors.length ? errors.join("; ") : undefined,
  });
  return { sent, devices: subs.length, errors };
}
