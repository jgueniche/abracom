import localFont from "next/font/local";

/**
 * The two faces a practice sheet needs and the rest of the application does not (ADR-0087):
 * French school cursive for the words a child copies (Playwrite France Moderne, TypeTogether)
 * and a Hebrew face that sets nikud properly (Noto Sans Hebrew). Declared here so that only the
 * practice pages load them.
 *
 * Kept in the repository rather than fetched from Google Fonts at build time: for Playwrite,
 * Google sometimes answers with a font address that has no file extension, and `next/font/google`
 * then fails the whole build (« Cannot read properties of null »), one build in two on the same
 * commit. Both faces are under the SIL Open Font License (`fonts/OFL-*.txt`), files from
 * Fontsource 5.3.0.
 */
export const playwriteFr = localFont({
  src: "./fonts/playwrite-fr-moderne-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-cursive",
});

export const notoHebrew = localFont({
  src: [
    { path: "./fonts/noto-sans-hebrew-hebrew-400-normal.woff2", weight: "400" },
    { path: "./fonts/noto-sans-hebrew-hebrew-600-normal.woff2", weight: "600" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-hebrew",
});
