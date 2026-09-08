import { readFileSync } from "node:fs";

import { contrastRatio, parseColor, rgbToHex, WCAG_AA_TEXT } from "../../lib/design/color.ts";

const css = readFileSync("app/globals.css", "utf8");
function block(selector: string): Record<string, string> {
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`);
  const body = re.exec(css)?.[1] ?? "";
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}
const light = block(":root");
const dark = { ...light, ...block(".dark") };
const pairs: Array<[string, string]> = [
  ["background", "foreground"],
  ["surface", "surface-foreground"],
  ["card", "card-foreground"],
  ["popover", "popover-foreground"],
  ["primary", "primary-foreground"],
  ["secondary", "secondary-foreground"],
  ["muted", "muted-foreground"],
  ["accent", "accent-foreground"],
  ["background", "muted-foreground"],
  ["sidebar", "sidebar-foreground"],
  ["sidebar-primary", "sidebar-primary-foreground"],
  ["sidebar-accent", "sidebar-accent-foreground"],
];
let failures = 0;
for (const [name, vars] of [
  ["light", light],
  ["dark", dark],
] as const) {
  console.log(`--- ${name}`);
  for (const [bg, fg] of pairs) {
    const ratio = contrastRatio(vars[bg]!, vars[fg]!);
    const ok = ratio >= WCAG_AA_TEXT;
    if (!ok) failures++;
    console.log(
      `${ok ? "ok " : "FAIL"} ${bg.padEnd(16)} / ${fg.padEnd(26)} ${ratio.toFixed(2)}  ${rgbToHex(parseColor(vars[bg]!))} on ${rgbToHex(parseColor(vars[fg]!))}`,
    );
  }
  const d = contrastRatio(vars["destructive"]!, "#ffffff");
  console.log(`${d >= WCAG_AA_TEXT ? "ok " : "FAIL"} destructive / white ${d.toFixed(2)}`);
  if (d < WCAG_AA_TEXT) failures++;
  console.log(`background hex: ${rgbToHex(parseColor(vars["background"]!))}`);
}
if (failures) {
  console.error(`${failures} pair(s) below AA`);
  process.exit(1);
}
