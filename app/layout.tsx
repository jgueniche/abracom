import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { type ReactNode } from "react";

import { Providers } from "@/components/layouts/providers";
import { themeColorHex } from "@/lib/design/tokens";
import { appName, publicEnv } from "@/lib/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/*
 * One editorial serif for both jobs — the title of a screen and the body of a
 * circular — instead of two faces that never met. Newsreader carries an
 * optical-size axis, so `font-optical-sizing: auto` gives a sturdy cut at
 * 15 px and a fine one at 26 px from a single file.
 *
 * It replaces Fraunces (ADR-0051): a soft, flared display face whose SOFT and
 * WONK axes are precisely the signature of the generic product look the owner
 * asked us to leave behind, and which no amount of restraint elsewhere could
 * outweigh while it set every heading in the application.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  axes: ["opsz"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
    title: { default: appName, template: `%s · ${appName}` },
    description: t("tagline"),
    applicationName: appName,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: appName },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColorHex.light },
    { media: "(prefers-color-scheme: dark)", color: themeColorHex.dark },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, requestHeaders] = await Promise.all([getLocale(), headers()]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
          <Providers nonce={nonce}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
