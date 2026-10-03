import type { Metadata, Viewport } from "next";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vokabelheft",
  description: "Englisch-Vokabeln üben mit Lückentexten",
  appleWebApp: { capable: true, title: "Vokabelheft" },
};

export const viewport: Viewport = {
  themeColor: "#1D3C8F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
