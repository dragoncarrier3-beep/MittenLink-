"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocationCombobox } from "./location-combobox";

/** Homepage search: a plain GET form to /search (works without JavaScript). */
export function HomeSearchForm() {
  const [location, setLocation] = useState("");
  return (
    <form role="search" aria-label="Search resources" action="/search" method="get" className="rounded-2xl border bg-card p-4 text-foreground shadow-md sm:p-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="home-q" className="text-base font-semibold">
            What are you looking for?
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              id="home-q"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="e.g. autism services, job coaching, respite care"
              className="min-h-12 w-full rounded-lg border border-input bg-card py-2 pr-3 pl-10 text-base"
            />
          </div>
        </div>
        <LocationCombobox value={location} onValueChange={setLocation} />
        <Button type="submit" size="lg" className="min-h-12">
          <Search aria-hidden /> Search Resources
        </Button>
      </div>
    </form>
  );
}
