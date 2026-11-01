import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The school's logo, as the school drew it (ADR-0085).
 *
 * Two cuts of the same official file (`public/brand/logo-abravanel.png`), trimmed of their
 * transparent margins and never redrawn or recoloured:
 *
 * - `SchoolLogo` — the whole logo, book, name and motto, where there is room for it to be read:
 *   the sign-in page.
 * - `SchoolMark` — the open book alone, for the header of every page. The header used to show
 *   the whole logo squeezed into 32 px, where « INSTITUTIONS ABRAVANEL » is three pixels high
 *   and the book a smudge: the porteur's « beaucoup trop petit ».
 *
 * The logo is drawn in dark ink on nothing. On the dark theme it would vanish, and recolouring
 * an official mark is the one thing a brand asset must not undergo, so it sits on a white
 * plate there — the way a printed logo sits on paper.
 */
export function SchoolLogo({
  alt,
  className,
  priority = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center dark:rounded-2xl dark:bg-white dark:p-4",
        className,
      )}
    >
      <Image
        src="/brand/abravanel-logo.png"
        alt={alt}
        width={720}
        height={656}
        priority={priority}
        sizes="(min-width: 1024px) 22rem, 13rem"
        className="h-auto w-full"
      />
    </span>
  );
}

export function SchoolMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center dark:rounded-md dark:bg-white dark:px-1 dark:py-0.5",
        className,
      )}
    >
      <Image
        src="/brand/abravanel-mark.png"
        alt=""
        width={310}
        height={192}
        priority
        sizes="5rem"
        className="h-full w-auto"
      />
    </span>
  );
}
