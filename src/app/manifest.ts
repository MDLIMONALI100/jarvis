import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "J.A.R.V.I.S. — Personal Assistant",
    short_name: "JARVIS",
    description: "Voice-first personal AI assistant",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#03070d",
    theme_color: "#03070d",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Daily Briefing", url: "/?action=briefing", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Call Me Now", url: "/?action=call", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
