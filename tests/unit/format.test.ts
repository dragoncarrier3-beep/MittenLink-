import { describe, expect, it } from "vitest";
import { formatDay, formatHours, formatMiles, formatCents, telHref, hostname } from "@/lib/format";
import { pageWindow } from "@/components/common/pagination";
import { listingHref } from "@/lib/links";

describe("format helpers", () => {
  it("formats date-only values without timezone shift", () => {
    expect(formatDay("2026-08-14")).toBe("August 14, 2026");
  });
  it("formats distances", () => {
    expect(formatMiles(4.83)).toBe("4.8 miles away");
    expect(formatMiles(23.6)).toBe("24 miles away");
    expect(formatMiles(null)).toBeNull();
  });
  it("formats hours in plain language", () => {
    expect(formatHours([{ day: "mon", open: "09:00", close: "17:30" }])).toEqual([{ day: "Monday", hours: "9 a.m. – 5:30 p.m." }]);
  });
  it("formats demo pricing", () => {
    expect(formatCents(2900)).toBe("$29");
  });
  it("builds tel links and hostnames", () => {
    expect(telHref("(734) 555-0182")).toBe("tel:7345550182");
    expect(hostname("https://www.greatlakesiln.example/about")).toBe("greatlakesiln.example");
  });
});

describe("pagination window", () => {
  it("shows all pages when few", () => expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]));
  it("collapses long ranges", () => expect(pageWindow(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]));
});

describe("listing links", () => {
  it("maps kinds to routes", () => {
    expect(listingHref("organization", "x")).toBe("/providers/x");
    expect(listingHref("resource", "y")).toBe("/guides/y");
  });
});
