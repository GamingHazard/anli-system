import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import AppClient from "@/features/workspace/app-client";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANLI MANAGEMENT SYSTEM",
  description:
    "An Obligated system tailored to hundle the company's daily operations",
  // generator: "v0.app",
  // icons: {
  //   icon: [
  //     {
  //       url: "/icon-light-32x32.png",
  //       media: "(prefers-color-scheme: light)",
  //     },
  //     {
  //       url: "/icon-dark-32x32.png",
  //       media: "(prefers-color-scheme: dark)",
  //     },
  //     {
  //       url: "/icon.svg",
  //       type: "image/svg+xml",
  //     },
  //   ],
  //   apple: "/apple-icon.png",
  // },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#6D28D9",
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
              <p className="text-sm text-slate-300">
                Checking secure session…
              </p>
            </main>
          }
        >
          <AppClient>{children}</AppClient>
        </Suspense>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
