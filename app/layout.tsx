import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Time Heist: Tuesday Again",
    template: "%s | Time Heist",
  },
  description:
    "You have 12 minutes. Fortunately, you have Tuesday forever.",
  applicationName: "Time Heist: Tuesday Again",
  keywords: ["browser game", "local co-op", "time loop", "museum heist"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Time Heist: Tuesday Again",
    description:
      "A chaotic local co-op museum heist trapped inside a twelve-minute time loop.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#11152b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
