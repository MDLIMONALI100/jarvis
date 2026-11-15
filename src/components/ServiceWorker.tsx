"use client";
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    // Registered in production; push notifications need it, so it also runs on
    // localhost when you explicitly enable them (see lib/push-client.ts).
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
