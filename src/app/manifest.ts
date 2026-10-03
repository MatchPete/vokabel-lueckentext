import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vokabelheft",
    short_name: "Vokabelheft",
    description: "Englisch-Vokabeln üben mit Lückentexten",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F9FC",
    theme_color: "#1D3C8F",
    lang: "de",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
