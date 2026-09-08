/** Event kinds and scopes (mirror of the `event_kind` / `event_scope` enums). */
export const EVENT_KINDS = [
  "celebration",
  "outing",
  "meeting",
  "volunteer",
  "holiday",
  "other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_SCOPES = ["school", "level", "class"] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];
