import { Noto_Sans_Hebrew, Playwrite_FR_Moderne } from "next/font/google";

/**
 * The two faces a practice sheet needs and the rest of the application does not (ADR-0087):
 * French school cursive for the words a child copies (Playwrite France Moderne, TypeTogether,
 * OFL — drawn for teaching handwriting the way French schools do), and a Hebrew face that sets
 * nikud properly. Declared here so that only the practice pages load them.
 */
export const cursive = Playwrite_FR_Moderne({
  weight: "400",
  display: "swap",
  variable: "--font-cursive",
});

export const hebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
  variable: "--font-hebrew",
});
