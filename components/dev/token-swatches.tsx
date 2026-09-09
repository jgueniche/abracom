"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { contrastRatio, parseColor, rgbToHex, WCAG_AA_TEXT } from "@/lib/design/color";
import { cn } from "@/lib/utils";

/** `fg: "white"` compares against literal white (buttons with `text-white`). */
export type TokenPair = { bg: string; fg: string; label?: string };

type Resolved = { bgHex: string; fgHex: string; ratio: number };

/**
 * Renders the live CSS tokens (as the browser resolves them, in the current theme)
 * with the WCAG contrast of each background / foreground pair.
 */
export function TokenSwatches({ pairs }: { pairs: TokenPair[] }) {
  const t = useTranslations("devUi.palette");
  const probeRef = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;

    function resolveToken(token: string): string {
      probe!.style.backgroundColor = token === "white" ? "#ffffff" : `var(--${token})`;
      return getComputedStyle(probe!).backgroundColor;
    }

    function compute() {
      const next: Record<string, Resolved> = {};
      for (const { bg, fg } of pairs) {
        try {
          const bgColor = parseColor(resolveToken(bg));
          const fgColor = parseColor(resolveToken(fg));
          next[`${bg}/${fg}`] = {
            bgHex: rgbToHex(bgColor),
            fgHex: rgbToHex(fgColor),
            ratio: contrastRatio(bgColor, fgColor),
          };
        } catch {
          // Unparseable computed value (unlikely): leave the pair without numbers.
        }
      }
      setResolved(next);
    }

    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [pairs]);

  return (
    <>
      <div ref={probeRef} aria-hidden className="hidden" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pairs.map(({ bg, fg, label }) => {
          const info = resolved[`${bg}/${fg}`];
          const pass = info ? info.ratio >= WCAG_AA_TEXT : undefined;
          return (
            <li
              key={`${bg}/${fg}`}
              className="flex flex-col gap-2 rounded-xl border p-3"
              style={{
                backgroundColor: `var(--${bg})`,
                color: fg === "white" ? "#ffffff" : `var(--${fg})`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{label ?? bg}</p>
                  <p className="truncate font-mono text-xs opacity-80">
                    --{bg} / --{fg}
                  </p>
                </div>
                {pass !== undefined && (
                  <Badge
                    variant={pass ? "secondary" : "destructive"}
                    className={cn("shrink-0", pass && "bg-white/70 text-current")}
                  >
                    {pass ? t("pass") : t("fail")}
                  </Badge>
                )}
              </div>
              {info && (
                <p className="font-mono text-xs opacity-80">
                  {info.bgHex} · {info.fgHex} · {t("contrast")} {info.ratio.toFixed(2)}:1
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
