import NextLink from "next/link";
import type { ComponentProps } from "react";

export type LinkProps = ComponentProps<typeof NextLink>;

/**
 * `next/link` with prefetching **off unless asked for**.
 *
 * On this deployment a prefetch is not a cheap hint: every visible link is a
 * full server render of its destination — a function invocation with its own
 * Supabase queries — and a single screen shows ten to twenty of them (the
 * conversations of a list, the three arrows of a week, the "new" buttons).
 * Three sessions in a row switched prefetching off one component at a time
 * (ADR-0061, ADR-0064, ADR-0065) and the measurement of ADR-0067 still found
 * seven prefetches on the messages screen and three on the diary, because the
 * default of `next/link` is opt-out and the codebase has eighty links.
 *
 * So the default is inverted here: nothing prefetches, and a link that should
 * says `prefetch` explicitly. ESLint forbids importing `next/link` directly.
 */
export function Link({ prefetch = false, ...props }: LinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
