import "server-only";
import { asPublic } from "@/lib/db";
import type { ActionState } from "@/lib/server/action-types";

/*
 * Server-side helpers shared by the community-input, claim and account routes.
 */

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Option {
  value: string;
  label: string;
}

export async function loadCountyOptions(): Promise<Option[]> {
  const rows = await asPublic((sql) => sql.query<{ id: number; name: string }>("select id, name from public.counties order by name"));
  return rows.map((r) => ({ value: String(r.id), label: `${r.name} County` }));
}

export async function loadCategoryOptions(): Promise<Option[]> {
  const rows = await asPublic((sql) =>
    sql.query<{ id: number; name: string }>("select id, name from public.categories where is_active order by sort_order, name"),
  );
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

export async function loadPopulationOptions(): Promise<Option[]> {
  const rows = await asPublic((sql) => sql.query<{ id: number; name: string }>("select id, name from public.populations order by sort_order, name"));
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

export async function loadLanguageOptions(): Promise<Option[]> {
  const rows = await asPublic((sql) => sql.query<{ code: string; name: string }>("select code, name from public.languages order by sort_order, name"));
  return rows.map((r) => ({ value: r.code, label: r.name }));
}

/**
 * formValues() only keeps the last value of repeated keys, so after a failed
 * submit we echo every checked value of array fields as a CSV that
 * CheckboxGroupField reads back (`${name}__selected`).
 */
export function withEchoedArrays(state: ActionState, formData: FormData, names: string[]): ActionState {
  if (state.status !== "error") return state;
  const values = { ...(state.values ?? {}) };
  for (const name of names) {
    values[`${name}__selected`] = formData
      .getAll(`${name}[]`)
      .filter((v): v is string => typeof v === "string")
      .join(",");
  }
  return { ...state, values };
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "organization"
  );
}

/** Same-site relative path check for redirects coming from stored data. */
export function safeRelativePath(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : null;
}
