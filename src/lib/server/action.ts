import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth";

import type { ActionState } from "./action-types";
export type { ActionState } from "./action-types";
export { idle } from "./action-types";

/** Error whose message is safe to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    // Never echo secrets back to the browser.
    if (typeof v === "string" && !k.startsWith("$") && !/password|confirm|token|secret/i.test(k)) out[k] = v;
  }
  return out;
}

/** Validate FormData with zod, returning a friendly error state on failure. */
export function parseForm<T extends z.ZodTypeAny>(schema: T, formData: FormData):
  | { ok: true; data: z.infer<T> }
  | { ok: false; state: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key).filter((v) => typeof v === "string") as string[];
    raw[key] = key.endsWith("[]") ? all : all.length > 1 ? all : all[0];
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    state: {
      status: "error",
      message: "Please correct the highlighted fields and try again.",
      fieldErrors,
      values: formValues(formData),
    },
  };
}

/**
 * Wraps an action body: converts authorization and user-facing errors into
 * friendly states and logs unexpected errors server-side with a reference id.
 */
export async function runAction(formData: FormData | null, fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    // Next.js redirects/notFound are implemented as thrown errors — rethrow them.
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) {
      throw err;
    }
    const values = formData ? formValues(formData) : undefined;
    if (err instanceof UserFacingError) return { status: "error", message: err.message, fieldErrors: err.fieldErrors, values };
    if (err instanceof AuthorizationError) return { status: "error", message: err.message, values };
    const ref = randomUUID().slice(0, 8);
    console.error(`[action:${ref}]`, err);
    return {
      status: "error",
      message: `We couldn't save your changes right now. Nothing was lost — please try again. (Reference ${ref})`,
      values,
    };
  }
}

// Common zod helpers ---------------------------------------------------------
export const zText = (label: string, max = 2000) =>
  z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`);
export const zOptionalText = (max = 2000) =>
  z.string().trim().max(max, `Must be ${max} characters or fewer.`).optional().transform((v) => (v ? v : null));
export const zEmail = (label = "Email") => z.string().trim().toLowerCase().email(`Enter a valid ${label.toLowerCase()}, like name@example.org.`);
export const zOptionalEmail = () =>
  z.string().trim().toLowerCase().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address.");
export const zOptionalUrl = () =>
  z.string().trim().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^https?:\/\/[^\s]+\.[^\s]+/.test(v), "Enter a full web address starting with https://");
export const zPhone = () =>
  z.string().trim().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^[0-9()+\-.\s]{7,20}$/.test(v), "Enter a valid phone number, like (734) 555-0100.");
export const zCheckbox = () => z.union([z.literal("on"), z.literal("true"), z.literal("")]).optional().transform((v) => v === "on" || v === "true");
