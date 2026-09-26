// Display helpers shared by server and client components.

export const TIMEZONE = "America/Detroit";

type DateInput = Date | string | null | undefined;
const toDate = (d: DateInput) => (d ? (d instanceof Date ? d : new Date(d)) : null);

export function formatDate(d: DateInput, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  const date = toDate(d);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, ...opts }).format(date);
}

/** Date-only columns (YYYY-MM-DD) must not shift by timezone. */
export function formatDay(d: DateInput, opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" }) {
  if (!d) return "—";
  const iso = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const [y, m, day] = iso.split("-").map(Number);
  if (!y || !m || !day) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, day)));
}

export const formatMonthYear = (d: DateInput) => formatDate(d, { month: "long", year: "numeric" });
export const formatShortDate = (d: DateInput) => formatDate(d, { month: "short", day: "numeric", year: "numeric" });
export const formatDateTime = (d: DateInput) =>
  formatDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export const formatTime = (d: DateInput) => formatDate(d, { hour: "numeric", minute: "2-digit" });

export function formatRelative(d: DateInput) {
  const date = toDate(d);
  if (!date) return "—";
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const mins = Math.round(abs / 60000);
  const sign = diff > 0 ? -1 : 1;
  if (mins < 60) return rtf.format(sign * mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(sign * hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(sign * days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(sign * months, "month");
  return rtf.format(sign * Math.round(months / 12), "year");
}

export function formatMiles(mi: number | null | undefined) {
  if (mi === null || mi === undefined || Number.isNaN(mi)) return null;
  if (mi < 0.1) return "Less than 0.1 miles away";
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} miles away`;
}

export function formatCents(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function telHref(phone: string | null | undefined) {
  return phone ? `tel:${phone.replace(/[^0-9+]/g, "")}` : undefined;
}

export function directionsHref(parts: (string | null | undefined)[]) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(parts.filter(Boolean).join(", "))}`;
}

export function hostname(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export function formatHours(hours: { day: string; open: string; close: string }[] | null | undefined) {
  if (!hours?.length) return [];
  const t = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "p.m." : "a.m.";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
  };
  return hours.map((h) => ({ day: DAY_NAMES[h.day] ?? h.day, hours: `${t(h.open)} – ${t(h.close)}` }));
}
