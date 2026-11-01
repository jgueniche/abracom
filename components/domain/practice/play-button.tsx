"use client";

import { SquareIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** One voice at a time across the sheet: starting a word stops the poem. */
let playing: HTMLAudioElement | null = null;

/**
 * Plays a recorded voice of the sheet (ADR-0087). A labelled button for a text or a poem,
 * an icon-sized one beside a word — 44 px either way, a child's finger is the pointer here.
 */
export function PlayButton({
  src,
  label,
  stopLabel,
  compact = false,
}: {
  src: string;
  label: string;
  stopLabel: string;
  compact?: boolean;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle() {
    if (!audio.current) {
      audio.current = new Audio(src);
      audio.current.addEventListener("ended", () => setOn(false));
      audio.current.addEventListener("pause", () => setOn(false));
      audio.current.addEventListener("play", () => setOn(true));
    }
    const current = audio.current;
    if (!current.paused) {
      current.pause();
      current.currentTime = 0;
      return;
    }
    if (playing && playing !== current) playing.pause();
    playing = current;
    void current.play().catch(() => setOn(false));
  }

  const Icon = on ? SquareIcon : Volume2Icon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={compact ? (on ? stopLabel : label) : undefined}
      className={cn(
        "no-print inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        compact ? "size-11" : "px-3",
        on && "bg-primary/10",
      )}
    >
      <Icon aria-hidden className={cn("size-5", on && "size-4 fill-current")} />
      {!compact && (on ? stopLabel : label)}
    </button>
  );
}
