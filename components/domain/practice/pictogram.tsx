import { PICTOGRAMS } from "@/lib/practice/pictograms.generated";
import type { PictogramKey } from "@/lib/practice/schema";
import { cn } from "@/lib/utils";

/**
 * The drawings a sheet counts and matches with (ADR-0087). Each drawing used on the page is
 * defined once, as a `<symbol>`, and every apple of « compte les 7 pommes » is a `<use>` of
 * it: seven copies would repeat the gradient ids inside the drawing, and a page with two ids
 * alike draws the wrong gradient.
 */
export function PictogramDefs({ keys }: { keys: Iterable<PictogramKey> }) {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return null;
  return (
    // Not `display: none`: a gradient inside a hidden SVG is not painted where it is used.
    <svg aria-hidden width="0" height="0" className="absolute size-0 overflow-hidden">
      <defs>
        {unique.map((key) => {
          const picture = PICTOGRAMS[key];
          return (
            <symbol
              key={key}
              id={`pg-${key}`}
              viewBox={`0 0 ${picture.width} ${picture.height}`}
              dangerouslySetInnerHTML={{ __html: picture.body }}
            />
          );
        })}
      </defs>
    </svg>
  );
}

export function Pictogram({
  name,
  label,
  className,
}: {
  name: PictogramKey;
  /** Spoken name, when the drawing carries meaning on its own (matching). */
  label?: string;
  className?: string;
}) {
  return (
    <svg
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-7 shrink-0", className)}
    >
      <use href={`#pg-${name}`} />
    </svg>
  );
}

export function pictogramName(name: PictogramKey, locale: string): string {
  return locale === "en" ? PICTOGRAMS[name].en : PICTOGRAMS[name].fr;
}
