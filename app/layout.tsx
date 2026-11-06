import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import AppClient from "@/features/workspace/app-client";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANLI MANAGEMENT SYSTEM",
  description:
    "An Obligated system tailored to hundle the company's daily operations",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/logo%20-%20192x192.jpeg",
        type: "image/jpeg",
        sizes: "192x192",
      },
      {
        url: "/logo%20512x512.jpeg",
        type: "image/jpeg",
        sizes: "512x512",
      },
    ],
    apple: "/logo%20-%20192x192.jpeg",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "ANLI",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#6D28D9",
    "msapplication-TileImage": "/logo%20512x512.jpeg",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#6D28D9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Suspense
          fallback={
            <main className="login-shell grid min-h-screen place-items-center">
              <p className="text-sm text-slate-300">Checking secure session…</p>
            </main>
          }
        >
          <AppClient>{children}</AppClient>
        </Suspense>
        <PwaInstallPrompt />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
