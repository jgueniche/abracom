import type { SubjectTone } from "@/lib/homework";

/**
 * The classes of each subject colour, written out in full so Tailwind finds them. `fill` paints
 * the ring once ticked, `ring` draws it before, `text` carries the burst of « Fait ».
 */
export const TONE_CLASSES: Record<
  SubjectTone,
  { ring: string; fill: string; text: string; bar: string }
> = {
  blue: {
    ring: "border-tone-blue",
    fill: "bg-tone-blue border-tone-blue",
    text: "text-tone-blue",
    bar: "bg-tone-blue",
  },
  green: {
    ring: "border-tone-green",
    fill: "bg-tone-green border-tone-green",
    text: "text-tone-green",
    bar: "bg-tone-green",
  },
  violet: {
    ring: "border-tone-violet",
    fill: "bg-tone-violet border-tone-violet",
    text: "text-tone-violet",
    bar: "bg-tone-violet",
  },
  amber: {
    ring: "border-tone-amber",
    fill: "bg-tone-amber border-tone-amber",
    text: "text-tone-amber",
    bar: "bg-tone-amber",
  },
  teal: {
    ring: "border-tone-teal",
    fill: "bg-tone-teal border-tone-teal",
    text: "text-tone-teal",
    bar: "bg-tone-teal",
  },
  rose: {
    ring: "border-tone-rose",
    fill: "bg-tone-rose border-tone-rose",
    text: "text-tone-rose",
    bar: "bg-tone-rose",
  },
  red: {
    ring: "border-tone-red",
    fill: "bg-tone-red border-tone-red",
    text: "text-tone-red",
    bar: "bg-tone-red",
  },
  slate: {
    ring: "border-tone-slate",
    fill: "bg-tone-slate border-tone-slate",
    text: "text-tone-slate",
    bar: "bg-tone-slate",
  },
};
