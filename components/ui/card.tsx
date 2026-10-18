import * as React from "react";
import { cn } from "cn";

/**
 * A group of things on a page: a title, what it says, what it holds.
 *
 * It used to be a plane drawn by a hairline, rounded and shadowed — and it was
 * used sixty-nine times, around forms that held bordered fields, around lists
 * that drew their own rules, inside pages whose sections drew theirs. The
 * porteur's verdict was « des rectangles dans des rectangles » (ADR-0078). A
 * card is now an unframed group: no border, no fill, no shadow, no inset; its
 * content starts on the page's own left edge, and what separates it from the
 * next group is the white space the page puts between them.
 *
 * The only boxes left in the application are the things a hand manipulates —
 * a field, a message bubble, a photograph.
 *
 * `--card-gap` is still the rhythm between the blocks inside it.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-gap) text-sm text-foreground [--card-gap:--spacing(3)] data-[size=sm]:[--card-gap:--spacing(2)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The title of an *interface* object — a destination, a setting, a figure. It
 * is set in the sans: the serif is the voice of the school (an announcement, a
 * note home, a cahier de vie entry), and it stops meaning anything the moment
 * a filter panel is titled in it too. See ContentCard for the editorial one.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-sans text-base leading-snug font-semibold tracking-[-0.006em] group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs leading-[1.5] text-pretty text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn(className)} {...props} />;
}

/** The group's last line — actions, a figure — set apart by space, not by a rule. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-footer" className={cn("flex items-center pt-1", className)} {...props} />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
