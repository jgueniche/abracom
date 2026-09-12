import * as React from "react";
import { cn } from "cn";

/**
 * A table, for the screens that hold a register.
 *
 * The administration listed sixty-six pupils as sixty-six bordered cards, one
 * under the other, in a column a third of the window wide: eleven thousand
 * pixels to show three facts per pupil, with no way to run the eye down the
 * classes or the guardians because nothing was in a column. A register is
 * tabular; setting it as a table is not a style choice, it is the shape of the
 * data.
 *
 * The head is set like every other label in the application — small caps, the
 * rule underneath — and the rows are separated by the inner filet, so a long
 * table stays quiet instead of drawing three hundred borders.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "relative border-b border-rule transition-colors last:border-b-0 hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "border-b border-border pb-1.5 text-left align-bottom text-[0.6875rem] leading-4 font-medium tracking-[0.085em] whitespace-nowrap text-muted-foreground uppercase first:pl-0 last:pr-0",
        "px-2",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-2 py-2.5 align-middle first:pl-0 last:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
