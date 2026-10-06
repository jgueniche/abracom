"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
} from "react";
import { toast } from "sonner";

import { doneKey, progressOf } from "@/lib/homework";
import { setHomeworkDone } from "@/server/actions/class-posts";

type Progress = {
  done: ReadonlySet<string>;
  toggle: (postId: string, studentId: string) => void;
};

const ProgressContext = createContext<Progress | null>(null);

/**
 * The ticks of a page, held once for every place that shows them: the ring on each homework,
 * the count of the day, the week strip, the line at the top.
 *
 * A tick used to be a form: the button waited for the server — half a second on a good day —
 * before anything moved, and nothing else on the page counted it until the next visit. It is
 * now drawn the instant it is tapped, everywhere at once, and undone with a message if the
 * database says no.
 */
export function HomeworkProgress({
  doneKeys,
  children,
}: {
  /** The ticks the server knows, as `postId:studentId`. */
  doneKeys: string[];
  children: ReactNode;
}) {
  const t = useTranslations("diary");
  const signature = doneKeys.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature is the dependency
  const base = useMemo(() => new Set(doneKeys), [signature]);
  const [done, apply] = useOptimistic(
    base,
    (state: ReadonlySet<string>, change: { key: string; done: boolean }) => {
      const next = new Set(state);
      if (change.done) next.add(change.key);
      else next.delete(change.key);
      return next;
    },
  );
  const [, startTransition] = useTransition();

  const toggle = useCallback(
    (postId: string, studentId: string) => {
      const key = doneKey(postId, studentId);
      const next = !done.has(key);
      if (next && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
      startTransition(async () => {
        apply({ key, done: next });
        const result = await setHomeworkDone({ postId, studentId, done: next }).catch(() => ({
          ok: false,
        }));
        if (!result.ok) toast.error(t("tickError"));
      });
    },
    [apply, done, t],
  );

  const value = useMemo(() => ({ done, toggle }), [done, toggle]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useHomeworkProgress(): Progress {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useHomeworkProgress outside HomeworkProgress");
  return value;
}

/** Done / total over a set of ticks — a day, a week, one homework for several children. */
export function useProgressOf(keys: readonly string[]) {
  const { done } = useHomeworkProgress();
  return progressOf(keys.length, keys.filter((key) => done.has(key)).length);
}
