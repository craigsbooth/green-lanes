import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green Lanes | Legal Byways Explorer - County Durham & Yorkshire",
  description:
    "Explore 2,000+ legal green lanes, BOATs and UCRs across County Durham and Yorkshire. Interactive map with difficulty ratings, route details, and street-level imagery.",
  keywords: [
    "green lanes",
    "BOAT",
    "byway open to all traffic",
    "UCR",
    "unclassified county road",
    "off road",
    "4x4",
    "greenlaning",
    "County Durham",
    "Yorkshire",
    "North Yorkshire",
    "definitive map",
  ],
  authors: [{ name: "Green Lanes Project" }],
  openGraph: {
    title: "Green Lanes | Legal Byways Explorer",
    description:
      "Explore 2,000+ legal green lanes across County Durham and Yorkshire. Filter by difficulty, surface type, and more.",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Green Lanes | Legal Byways Explorer",
    description:
      "Explore 2,000+ legal green lanes across County Durham and Yorkshire.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2d6a4f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
