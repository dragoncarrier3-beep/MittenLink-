// Shared (client-safe) types for server action results.
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; warning?: string; redirectTo?: string; data?: Record<string, unknown> }
  | { status: "error"; message: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export const idle: ActionState = { status: "idle" };
