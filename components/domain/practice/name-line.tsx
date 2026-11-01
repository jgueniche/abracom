"use client";

import { useState } from "react";

/**
 * « Prénom : … — Date : … » at the top of the sheet. Kesher writes the child's first name
 * itself, after the model has answered: the name never travels to the model (ADR-0087). With
 * several children in the class, the parent picks whose sheet it is; the choice is not
 * printed, only the name.
 */
export function NameLine({
  names,
  nameLabel,
  dateLabel,
  forLabel,
  nobodyLabel,
}: {
  names: string[];
  nameLabel: string;
  dateLabel: string;
  forLabel: string;
  nobodyLabel: string;
}) {
  const [name, setName] = useState(names.length === 1 ? names[0]! : "");
  return (
    <div className="mb-6">
      {names.length > 1 && (
        <label className="no-print mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          {forLabel}
          <select
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 cursor-pointer rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">{nobodyLabel}</option>
            {names.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <span className="flex min-w-48 flex-1 items-end gap-2">
          <span className="text-muted-foreground">{nameLabel} :</span>
          <span className="flex-1 border-b border-dashed border-foreground/40 pb-0.5 font-cursive text-lg leading-none">
            {name || " "}
          </span>
        </span>
        <span className="flex w-40 items-end gap-2">
          <span className="text-muted-foreground">{dateLabel} :</span>
          <span className="flex-1 border-b border-dashed border-foreground/40 pb-0.5">&nbsp;</span>
        </span>
      </p>
    </div>
  );
}
