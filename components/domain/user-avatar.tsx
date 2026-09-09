import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Every avatar in the app was the same grey monogram, so a class channel showed
 * sixty identical circles. The tone is derived from the person's own name: it is
 * stable, needs no upload, and makes a thread scannable.
 * Mostly blues, to stay inside the palette, plus two warm tints so that two
 * people side by side are never the same colour. All are token pairs, so they
 * hold up in both themes.
 */
const TONES = [
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-primary/15 text-primary",
  "bg-success/15 text-success",
  "bg-brick/12 text-brick",
  "bg-muted text-muted-foreground",
] as const;

export function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

export function UserAvatar({
  name,
  initials,
  className,
  toneSeed,
}: {
  name?: string;
  initials: string;
  className?: string;
  /** Defaults to the name, so the same person keeps the same tone everywhere. */
  toneSeed?: string;
}) {
  return (
    <Avatar className={cn("size-9 shrink-0", className)}>
      <AvatarFallback
        className={cn("text-xs font-semibold", avatarTone(toneSeed ?? name ?? initials))}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
