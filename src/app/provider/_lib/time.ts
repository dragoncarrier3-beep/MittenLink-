import { TIMEZONE } from "@/lib/format";

function offsetMinutesAt(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, timeZoneName: "longOffset" }).formatToParts(new Date(utcMs));
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(tz);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Converts a local wall-clock date + time in America/Detroit to an ISO 8601
 * string with the correct UTC offset (handles daylight saving time).
 * Returns null for invalid input.
 */
export function detroitLocalToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return null;
  let offset = offsetMinutesAt(wall);
  const second = offsetMinutesAt(wall - offset * 60000);
  if (second !== offset) offset = second;
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
