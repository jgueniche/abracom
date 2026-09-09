/** Client-safe initial state for admin forms (the server helpers live in _shared.ts). */
export type ActionState = { status: "idle" | "success" | "error"; message?: string };

export const idle: ActionState = { status: "idle" };
