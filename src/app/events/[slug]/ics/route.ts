import { NextResponse } from "next/server";
import { getEventDetail } from "@/lib/data/profiles";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Add-to-calendar (.ics) download for a published event. */
export async function GET(request: Request, ctx: RouteContext<"/events/[slug]/ics">) {
  const { slug } = await ctx.params;
  try {
    const d = await getEventDetail(slug);
    if (!d) return new NextResponse("Event not found", { status: 404 });
    const e = d.event;
    const origin = new URL(request.url).origin;
    const location = e.is_in_person ? [e.venue_name, e.street, e.city ? `${e.city}, MI ${e.zip ?? ""}`.trim() : null].filter(Boolean).join(", ") : "Online";
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MittenLink//Michigan Disability Resource Network//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${e.id}@mittenlink`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(new Date(e.starts_at))}`,
      `DTEND:${stamp(new Date(e.ends_at))}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.summary}\n\nDetails: ${origin}/events/${e.slug}`)}`,
      `LOCATION:${esc(location)}`,
      `URL:${origin}/events/${e.slug}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${e.slug}.ics"`,
      },
    });
  } catch (err) {
    console.error("[events/ics] failed", err);
    return new NextResponse("We couldn't create the calendar file right now. Please try again.", { status: 500 });
  }
}
