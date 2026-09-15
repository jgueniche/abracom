import { getTranslations } from "next-intl/server";

import { Column } from "@/components/layouts/column";

/**
 * What a screen looks like before the server has answered.
 *
 * A click used to produce nothing until the whole page had been rendered —
 * session, queries, markup. On the hosted deployment that is 300 to 600 ms on
 * a warm function and more than a second on a new one, and it is exactly what
 * « c'est lent » names: not the wait, the silence (ADR-0068). Behind a
 * `loading.tsx` boundary the header and the tab bar stay, the page area shows
 * the shape of a page as soon as the click is heard, and the content replaces
 * it when it arrives.
 *
 * Deliberately quiet: one column, a title line, a few rules — the anatomy of
 * every screen (ADR-0052), in the muted tone, pulsing slowly. No spinner.
 */
export async function PageLoading() {
  const t = await getTranslations("common");
  return (
    <Column width="text">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-slot="page-loading"
        className="motion-safe:animate-pulse"
      >
        <span className="sr-only">{t("loading")}</span>
        <div className="mb-1.5 h-3 w-24 rounded bg-muted" aria-hidden />
        <div className="h-6 w-2/5 rounded bg-muted" aria-hidden />
        <div className="mt-2 h-3.5 w-3/5 rounded bg-muted" aria-hidden />
        <ul className="mt-8 divide-y divide-rule border-y border-rule" aria-hidden>
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="flex items-center gap-4 py-3.5">
              <div className="h-3.5 w-16 rounded bg-muted" />
              <div
                className="h-3.5 flex-1 rounded bg-muted"
                style={{ maxWidth: `${64 - row * 9}%` }}
              />
            </li>
          ))}
        </ul>
      </div>
    </Column>
  );
}
