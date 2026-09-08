import { formatOklch, hexToRgb, rgbToOklch } from "../../lib/design/color.ts";

const brand = {
  teal: "#01525e",
  red: "#852624",
  gold: "#e3b383",
  goldLight: "#fbe29e",
  taupe: "#584a47",
};
for (const [name, hex] of Object.entries(brand)) {
  console.log(name.padEnd(10), hex, formatOklch(rgbToOklch(hexToRgb(hex))));
}
