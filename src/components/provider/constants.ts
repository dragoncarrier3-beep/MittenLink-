// Client-safe constants and helpers for provider forms.
import { TIMEZONE } from "@/lib/format";

export const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

export type DayKey = (typeof DAYS)[number]["key"];

export const LOCATION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  temporarily_closed: "Temporarily closed",
  closed: "Permanently closed",
};

export const PUBLICATION_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending publication",
  published: "Published",
  archived: "Archived",
};

export const TRI_STATE_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not sure / not listed" },
];

export const triValue = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "unknown");

/** Key used in ActionState.values to restore multi-select checkbox groups after a failed submit. */
export const multiKey = (name: string) => `__multi:${name}`;

/** Splits a timestamp into the local (America/Detroit) date and time strings used by date/time inputs. */
export function localParts(value: Date | string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Date-only value (Date or string) → YYYY-MM-DD for <input type="date">. */
export function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
