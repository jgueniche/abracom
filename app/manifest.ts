import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { brand, themeColorHex } from "@/lib/design/tokens";
import { appName } from "@/lib/env";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("common")]);

  return {
    name: appName,
    short_name: appName,
    description: t("tagline"),
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: themeColorHex.light,
    theme_color: brand.teal,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
