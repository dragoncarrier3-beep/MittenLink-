// Helpers for "?done=…&warn=1" result banners on staff pages (server-safe).

export type SearchParams = Record<string, string | string[] | undefined>;

export const EMAIL_WARNING = "The update was saved, but the notification email could not be sent.";

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Resolve the banner message for the current `done` code. */
export function resultFor(sp: SearchParams, messages: Record<string, string>) {
  const done = param(sp, "done");
  const n = param(sp, "n");
  const raw = done ? messages[done] ?? null : null;
  const message = raw ? raw.replace("{n}", n && /^\d+$/.test(n) ? n : "0") : null;
  return { message, warning: message && param(sp, "warn") === "1" ? EMAIL_WARNING : null };
}

/** Build the redirect target after an action: `path?done=code[&warn=1]`. */
export function doneUrl(path: string, code: string, warning?: string | null, extra?: Record<string, string>) {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.delete("done");
  params.delete("warn");
  params.delete("n");
  params.set("done", code);
  if (warning) params.set("warn", "1");
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  return `${base}?${params.toString()}`;
}

/** Only allow same-site staff paths as "return to" targets. */
export function safeReturn(value: FormDataEntryValue | null | undefined, fallback: string, prefixes = ["/verify", "/admin"]) {
  const v = typeof value === "string" ? value : "";
  if (!v.startsWith("/") || v.startsWith("//")) return fallback;
  return prefixes.some((p) => v === p || v.startsWith(p + "/") || v.startsWith(p + "?")) ? v : fallback;
}
