// J.A.R.V.I.S. service worker — app-shell caching + offline fallback.
// API responses are never cached (they are private and must be fresh).
const CACHE = "jarvis-v2";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/icons/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Static build assets: cache-first (they are content-hashed).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network-first, offline page as fallback.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: "J.A.R.V.I.S.", body: e.data ? e.data.text() : "" };
  }
  const title = data.title || "J.A.R.V.I.S.";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.urgent),
      vibrate: data.urgent ? [400, 150, 400, 150, 400] : [200],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(
    (async () => {
      // External links (e.g. a Meet link) open directly; app links focus an open window.
      if (new URL(target).origin === self.location.origin) {
        const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const w of wins) {
          if (new URL(w.url).origin === self.location.origin) {
            await w.focus();
            return w.navigate(target).catch(() => {});
          }
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

// Browser rotated the subscription: re-register it with the server.
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(
    (async () => {
      const res = await fetch("/api/push", { credentials: "include" });
      if (!res.ok) return;
      const { publicKey } = await res.json();
      const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
      const key = Uint8Array.from(atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...sub.toJSON(), label: "renewed subscription" }),
      });
    })(),
  );
});
