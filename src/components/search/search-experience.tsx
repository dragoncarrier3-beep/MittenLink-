"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Info, List, Loader2, Map as MapIcon, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/common/error-state";
import { Pagination } from "@/components/common/pagination";
import { ResultCard } from "@/components/listings/result-card";
import { cn } from "@/lib/utils";
import { KIND_PLURAL, ORG_TYPE_LABELS } from "@/lib/labels";
import {
  activeFilterCount,
  clearFilters,
  DELIVERY_LABELS,
  parseSearchParams,
  RADII,
  SORT_LABELS,
  SORTS,
  toQueryString,
  type SearchParams,
  type Sort,
} from "@/lib/search/params";
import type { FilterOptions, ListingCardData, SearchErrorResponse, SearchResponse } from "@/lib/search/types";
import type { MapMarker } from "@/lib/integrations/maps";
import { FilterPanel } from "./filter-panel";
import { LocationCombobox } from "./location-combobox";
import { SaveSearchButton } from "./save-search-button";
import { SearchMap } from "./search-map";

const SEARCH_ERROR = "We couldn't complete your search. Your filters have been preserved.";
type Trigger = "query" | "filter" | "location" | "page" | "sort";

interface FetchOptions {
  commit: boolean;
  trigger: Trigger;
  history?: "replace" | "push" | "none";
  focusResults?: boolean;
  abandoned?: boolean;
}

export function SearchExperience({
  initialParams,
  initialData,
  initialError,
  options,
}: {
  initialParams: SearchParams;
  initialData: SearchResponse | null;
  initialError: string | null;
  options: FilterOptions;
}) {
  const [params, setParams] = useState<SearchParams>(initialParams);
  const [qText, setQText] = useState(initialData?.interpreted?.q ?? initialParams.q);
  const [locText, setLocText] = useState(initialData?.interpreted?.location ?? initialParams.location);
  const [data, setData] = useState<SearchResponse | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<SearchParams>(initialParams);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const paramsRef = useRef(params);
  const lastQs = useRef(toQueryString(initialParams));
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const typingTimers = useRef<number[]>([]);
  const lastCommitZero = useRef(initialData?.outcome === "zero");
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => setHydrated(true), []);

  const writeUrl = useCallback((next: SearchParams, mode: "replace" | "push") => {
    const qs = toQueryString(next);
    lastQs.current = qs;
    const url = qs ? `/search?${qs}` : "/search";
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const clearTyping = () => {
    typingTimers.current.forEach((t) => window.clearTimeout(t));
    typingTimers.current = [];
  };

  const runFetch = useCallback(
    async (next: SearchParams, opts: FetchOptions) => {
      paramsRef.current = next;
      setParams(next);
      if (opts.history !== "none") writeUrl(next, opts.history ?? "replace");
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const seq = ++seqRef.current;
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams(toQueryString(next));
      if (opts.commit) qs.set("commit", "1");
      qs.set("trigger", opts.trigger);
      if (opts.abandoned) qs.set("abandoned", "1");
      try {
        const res = await fetch(`/api/search?${qs.toString()}`, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        const json = (await res.json()) as SearchResponse | SearchErrorResponse;
        if (seq !== seqRef.current) return;
        if (!json.ok) {
          setError(json.error || SEARCH_ERROR);
          return;
        }
        setData(json);
        if (opts.commit) lastCommitZero.current = json.outcome === "zero";
        if (json.interpreted) {
          const interpreted = { ...next, q: json.interpreted.q, location: json.interpreted.location };
          paramsRef.current = interpreted;
          setParams(interpreted);
          setQText(interpreted.q);
          setLocText(interpreted.location);
          writeUrl(interpreted, "replace");
        }
        if (opts.focusResults) {
          window.requestAnimationFrame(() => {
            resultsHeadingRef.current?.focus({ preventScroll: true });
            resultsHeadingRef.current?.scrollIntoView({ block: "start" });
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        if (seq !== seqRef.current) return;
        setError(SEARCH_ERROR);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [writeUrl],
  );

  // Canonicalize the URL when the server split a natural-language query.
  useEffect(() => {
    if (initialData?.interpreted) {
      const next = { ...initialParams, q: initialData.interpreted.q, location: initialData.interpreted.location };
      paramsRef.current = next;
      setParams(next);
      writeUrl(next, "replace");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back/forward navigation: re-sync from the URL.
  const spString = searchParams.toString();
  useEffect(() => {
    const parsed = parseSearchParams(new URLSearchParams(spString));
    const qs = toQueryString(parsed);
    if (qs === lastQs.current) return;
    lastQs.current = qs;
    setQText(parsed.q);
    setLocText(parsed.location);
    runFetch(parsed, { commit: false, trigger: "page", history: "none" });
  }, [spString, runFetch]);

  useEffect(() => () => clearTyping(), []);

  // --- Event handlers -------------------------------------------------------
  const onQueryChange = (v: string) => {
    setQText(v);
    clearTyping();
    const next = { ...paramsRef.current, q: v.trim(), page: 1 };
    // Live results after a short pause; the search is "committed" (logged)
    // only after a longer pause of 1.2 seconds or an explicit submit.
    typingTimers.current.push(window.setTimeout(() => runFetch(next, { commit: false, trigger: "query" }), 450));
    typingTimers.current.push(window.setTimeout(() => runFetch(next, { commit: true, trigger: "query" }), 1200));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearTyping();
    runFetch({ ...paramsRef.current, q: qText.trim(), location: locText.trim(), page: 1 }, { commit: true, trigger: "query", focusResults: false });
  };

  const applyFilters = (next: SearchParams) => {
    const prev = paramsRef.current;
    const abandoned = lastCommitZero.current && activeFilterCount(next) < activeFilterCount(prev);
    if (next.location !== prev.location) setLocText(next.location);
    runFetch({ ...next, q: qText.trim(), location: next.location, page: 1 }, { commit: true, trigger: "filter", abandoned });
  };

  const setView = (view: "list" | "map") => {
    const next = { ...paramsRef.current, view };
    paramsRef.current = next;
    setParams(next);
    writeUrl(next, "replace");
  };

  const showOnMap = (id: string) => {
    if (paramsRef.current.view !== "map") setView("map");
    setActiveId(id);
    setFocusNonce((n) => n + 1);
    window.requestAnimationFrame(() => mapWrapRef.current?.scrollIntoView({ block: "nearest" }));
  };

  const onMarkerSelect = useCallback((id: string) => {
    setActiveId(id);
    const card = document.querySelector<HTMLElement>(`[data-listing-id="${CSS.escape(id)}"]`);
    if (card) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      card.querySelector<HTMLAnchorElement>("h2 a, h3 a, h4 a")?.focus({ preventScroll: true });
    }
  }, []);

  const interceptPagination = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest("a");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, window.location.href);
    if (url.pathname !== "/search") return;
    e.preventDefault();
    const page = parseSearchParams(url.searchParams).page;
    runFetch({ ...paramsRef.current, page }, { commit: false, trigger: "page", history: "push", focusResults: true });
  };

  const retry = () => runFetch(paramsRef.current, { commit: false, trigger: "query" });

  // --- Derived view data ----------------------------------------------------
  const results = data?.results ?? [];
  const local = results.filter((r) => r.matchScope !== "statewide");
  const statewide = results.filter((r) => r.matchScope === "statewide");
  const saved = useMemo(() => new Set(data?.savedIds ?? []), [data]);
  const filterCount = activeFilterCount(params);
  const qs = toQueryString(params);
  const nextPath = `/search${qs ? `?${qs}` : ""}`;
  const loc = data?.location ?? null;
  const locPhrase = loc ? (loc.kind === "county" ? `in ${loc.label}` : `within ${loc.radius} miles of ${loc.label}`) : "";

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    results.forEach((r, i) =>
      r.points.forEach((p) => out.push({ id: r.id, lat: p.lat, lng: p.lng, title: r.title, subtitle: p.label, badge: String(i + 1) })),
    );
    return out;
  }, [results]);

  const statusText = (() => {
    if (loading) return "Updating results…";
    if (error || !data) return "";
    if (data.total === 0) return "No exact matches found.";
    if (data.noLocalMatch) return `No exact matches ${locPhrase}. Showing ${data.statewideCount} statewide or virtual ${data.statewideCount === 1 ? "resource" : "resources"}.`;
    const base = `${data.total.toLocaleString("en-US")} ${data.total === 1 ? "resource" : "resources"} found`;
    return loc ? `${base}: ${data.localCount} ${locPhrase}${data.statewideCount ? ` and ${data.statewideCount} statewide or virtual` : ""}.` : `${base}.`;
  })();

  const chips = buildChips(params, options);

  const suggestNeedHref = `/suggest?${new URLSearchParams({ type: "need", ...(params.q ? { q: params.q } : {}), ...(params.location ? { location: params.location } : {}) }).toString()}`;

  const cardProps = (item: ListingCardData, index: number) => ({
    item,
    saved: saved.has(item.id),
    signedIn: !!data?.signedIn,
    nextPath,
    active: activeId === item.id,
    mapAction:
      item.points.length > 0 && hydrated ? (
        <Button variant="outline" size="sm" className="min-h-11" onClick={() => showOnMap(item.id)}>
          <MapPin aria-hidden />
          Show on map<span className="sr-only"> (result {index + 1}, {item.title})</span>
        </Button>
      ) : undefined,
  });

  const indexOf = (id: string) => results.findIndex((r) => r.id === id);

  // --- Render -----------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6">
      {/* Primary search form: a real GET form so it works without JavaScript. */}
      <form role="search" aria-label="Search resources" action="/search" method="get" onSubmit={onSubmit} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto] md:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="search-q" className="text-base font-semibold text-foreground">
              What are you looking for?
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="search-q"
                name="q"
                type="search"
                value={qText}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="e.g. autism services, job coaching, respite care"
                autoComplete="off"
                className="min-h-12 w-full rounded-lg border border-input bg-card py-2 pr-3 pl-10 text-base"
              />
            </div>
          </div>
          <LocationCombobox
            value={locText}
            onValueChange={setLocText}
            onSelect={(s) => {
              clearTyping();
              runFetch({ ...paramsRef.current, q: qText.trim(), location: s.label, page: 1 }, { commit: true, trigger: "location" });
            }}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="search-radius" className="text-base font-semibold text-foreground">
              Distance
            </label>
            <select
              id="search-radius"
              name="radius"
              value={params.radius ?? ""}
              onChange={(e) => {
                const radius = e.target.value ? Number(e.target.value) : null;
                runFetch({ ...paramsRef.current, q: qText.trim(), location: locText.trim(), radius, page: 1 }, { commit: true, trigger: "filter" });
              }}
              aria-describedby="search-radius-hint"
              className="min-h-12 w-full rounded-lg border border-input bg-card px-3 text-base md:w-40"
            >
              <option value="">Default (25 miles)</option>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  Within {r} miles
                </option>
              ))}
            </select>
            <span id="search-radius-hint" className="sr-only">
              Applies to city and ZIP code searches. County searches include the whole county.
            </span>
          </div>
          <Button type="submit" size="lg" className="min-h-12">
            <Search aria-hidden /> Search Resources
          </Button>
        </div>
        {/* Keep current refinements when the form is submitted without JavaScript. */}
        {!hydrated && <HiddenFilterInputs params={params} exclude={["q", "location", "radius"]} />}
      </form>

      {data?.interpreted && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-foreground">
          <Info className="mt-1 size-4 shrink-0 text-info" aria-hidden />
          <span>
            Showing results for <strong>“{data.interpreted.q}”</strong> near <strong>{data.interpreted.location}</strong>.
          </span>
        </p>
      )}
      {data?.locationCorrectedFrom && data.location && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-foreground">
          <Info className="mt-1 size-4 shrink-0 text-info" aria-hidden />
          <span>
            Showing results for <strong>{data.location.label}</strong>, the closest Michigan match to “{data.locationCorrectedFrom}”.
          </span>
        </p>
      )}
      {data?.locationUnmatched && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-foreground">
          <Info className="mt-1 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            We couldn’t find “{data.locationUnmatched}” in Michigan, so these results are from across the state. Try a city, ZIP code, or county name.
          </span>
        </p>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className="text-lg font-semibold text-foreground">
          {loading && <Loader2 className="mr-2 inline size-5 animate-spin align-[-3px]" aria-hidden />}
          {statusText}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" className="lg:hidden" onClick={() => { setDraft(paramsRef.current); setDrawerOpen(true); }} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden /> Filters
            {filterCount > 0 && (
              <span className="rounded-full bg-primary px-2 text-sm text-primary-foreground">
                {filterCount}
                <span className="sr-only"> active</span>
              </span>
            )}
          </Button>
          <div className="flex items-center gap-2">
            <label htmlFor="search-sort" className="font-semibold">
              Sort by
            </label>
            <select
              id="search-sort"
              value={params.sort}
              onChange={(e) => runFetch({ ...paramsRef.current, sort: e.target.value as Sort, page: 1 }, { commit: false, trigger: "sort" })}
              className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
            >
              {SORTS.map((s) => (
                <option key={s} value={s} disabled={s === "distance" && (!loc || loc.kind === "county")}>
                  {SORT_LABELS[s]}
                  {s === "distance" && (!loc || loc.kind === "county") ? " (enter a city or ZIP)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-label="Results view" className="inline-flex rounded-lg border bg-card p-0.5">
            <button type="button" aria-pressed={params.view === "list"} onClick={() => setView("list")} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-semibold", params.view === "list" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
              <List className="size-4" aria-hidden /> List
            </button>
            <button type="button" aria-pressed={params.view === "map"} onClick={() => setView("map")} className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-semibold", params.view === "map" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")}>
              <MapIcon className="size-4" aria-hidden /> Map
            </button>
          </div>
          <SaveSearchButton
            signedIn={!!data?.signedIn}
            queryString={toQueryString(params, { page: 1, view: "list" })}
            defaultName={`${params.q || "All resources"}${params.location ? ` near ${params.location}` : ""}`.slice(0, 120)}
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="sr-only">Active filters</h2>
          <ul className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => applyFilters(c.remove(paramsRef.current))}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/40 bg-secondary px-3 font-semibold text-secondary-foreground hover:bg-lake-soft"
                >
                  {c.label}
                  <X className="size-4" aria-hidden />
                  <span className="sr-only">(remove filter)</span>
                </button>
              </li>
            ))}
          </ul>
          {filterCount > 0 && (
            <Button variant="link" onClick={() => applyFilters(clearFilters(paramsRef.current))}>
              Clear all filters
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Desktop filter sidebar (also the no-JS filter form on every screen size). */}
        <aside aria-labelledby="filters-heading" className={cn("order-last lg:order-first", hydrated ? "hidden lg:block" : "block")}>
          <form
            action="/search"
            method="get"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters(paramsRef.current);
            }}
            className="rounded-xl border bg-card p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          >
            <h2 id="filters-heading" className="mb-4 text-xl font-bold">
              Filter results
            </h2>
            <HiddenFilterInputs params={params} only={["q", "location", "radius", "sort", "view"]} />
            <FilterPanel value={params} onChange={applyFilters} options={options} idPrefix="side" />
            {!hydrated && (
              <Button type="submit" className="mt-6 w-full">
                Apply filters
              </Button>
            )}
            {hydrated && filterCount > 0 && (
              <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => applyFilters(clearFilters(paramsRef.current))}>
                Clear all filters
              </Button>
            )}
          </form>
        </aside>

        <div className={cn("min-w-0", params.view === "map" && "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
          {params.view === "map" && (
            <div ref={mapWrapRef} className="xl:order-last">
              <div className="xl:sticky xl:top-24">
                <SearchMap markers={markers} focusId={activeId} focusNonce={focusNonce} onSelect={onMarkerSelect} />
              </div>
            </div>
          )}

          <section aria-labelledby="results-heading" aria-busy={loading} className={cn("flex min-w-0 flex-col gap-6", loading && "opacity-70")}>
            <h2 id="results-heading" ref={resultsHeadingRef} tabIndex={-1} className="sr-only">
              {params.view === "map" ? "Map results list" : "Search results"}
            </h2>
            {params.view === "map" && markers.length > 0 && (
              <p className="text-sm text-muted-foreground">Numbers on the map match the numbered results in this list. Every mapped result is listed here.</p>
            )}

            {error ? (
              <ErrorState title="Search unavailable" message={error} onRetry={retry} retryLabel="Retry search" />
            ) : !data ? (
              <ErrorState title="Search unavailable" message={SEARCH_ERROR} onRetry={retry} retryLabel="Retry search" autoFocus={false} />
            ) : (
              <>
                {(data.total === 0 || data.noLocalMatch) && (
                  <NoMatchPanel
                    zeroAll={data.total === 0}
                    params={params}
                    data={data}
                    hasStatewide={statewide.length > 0}
                    suggestNeedHref={suggestNeedHref}
                    onExpand={(radius) => runFetch({ ...paramsRef.current, radius, page: 1 }, { commit: true, trigger: "filter" })}
                    onRemoveFilters={() => applyFilters(clearFilters(paramsRef.current))}
                    onAllMichigan={() => {
                      setLocText("");
                      runFetch({ ...paramsRef.current, location: "", radius: null, page: 1 }, { commit: true, trigger: "location" });
                    }}
                  />
                )}

                {local.length > 0 && (
                  <ResultGroup title={loc ? `Resources ${locPhrase}` : data.total === results.length && !params.q && filterCount === 0 ? "All resources" : "Matching resources"}>
                    {local.map((r) => (
                      <li key={r.id}>
                        <ResultCard {...cardProps(r, indexOf(r.id))} />
                      </li>
                    ))}
                  </ResultGroup>
                )}

                {statewide.length > 0 && (
                  <ResultGroup
                    id="statewide-results"
                    title="Statewide and virtual resources"
                    icon={<Globe2 className="size-6 text-primary" aria-hidden />}
                    description={loc ? `These serve all of Michigan or are available virtually, so they are available ${loc.kind === "county" ? "in" : "near"} ${loc.label}.` : "These serve all of Michigan or are available virtually."}
                  >
                    {statewide.map((r) => (
                      <li key={r.id}>
                        <ResultCard {...cardProps(r, indexOf(r.id))} />
                      </li>
                    ))}
                  </ResultGroup>
                )}

                {data.fallback && data.fallback.related.length > 0 && (
                  <ResultGroup
                    title={data.fallback.relatedLabel}
                    description="These are real listings found by broadening your search. They may not be an exact match, so check the details."
                    action={data.fallback.relatedHref ? { href: data.fallback.relatedHref, label: "See all of these results" } : undefined}
                  >
                    {data.fallback.related.map((r) => (
                      <li key={r.id}>
                        <ResultCard item={r} saved={saved.has(r.id)} signedIn={data.signedIn} nextPath={nextPath} compact />
                      </li>
                    ))}
                  </ResultGroup>
                )}

                <div onClickCapture={interceptPagination}>
                  <Pagination page={data.page} pageSize={data.pageSize} total={data.total} hrefFor={(p) => `/search?${toQueryString(params, { page: p })}`} label="Search results pages" />
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Mobile filter drawer: focus trap, Escape to close, focus returns to the Filters button. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full sm:max-w-md">
          <SheetHeader className="border-b p-4 pr-14">
            <SheetTitle className="text-xl font-bold">Filter results</SheetTitle>
            <SheetDescription className="text-base">
              {activeFilterCount(draft) > 0 ? `${activeFilterCount(draft)} filter${activeFilterCount(draft) === 1 ? "" : "s"} selected` : "No filters selected"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <FilterPanel value={draft} onChange={setDraft} options={options} idPrefix="drawer" />
          </div>
          <SheetFooter className="flex-row gap-2 border-t bg-card p-4">
            <Button variant="outline" className="flex-1" onClick={() => setDraft(clearFilters(draft))}>
              Clear all
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setDrawerOpen(false);
                applyFilters(draft);
              }}
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ResultGroup({
  id,
  title,
  description,
  icon,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const headingId = `${id ?? title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className="flex items-center gap-2 text-2xl font-bold">
            {icon}
            {title}
          </h2>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
        {action && (
          <Link href={action.href} className="font-semibold text-primary underline">
            {action.label}
          </Link>
        )}
      </div>
      <ol className="flex flex-col gap-4">{children}</ol>
    </section>
  );
}

function NoMatchPanel({
  zeroAll,
  params,
  data,
  hasStatewide,
  suggestNeedHref,
  onExpand,
  onRemoveFilters,
  onAllMichigan,
}: {
  zeroAll: boolean;
  params: SearchParams;
  data: SearchResponse;
  hasStatewide: boolean;
  suggestNeedHref: string;
  onExpand: (radius: number) => void;
  onRemoveFilters: () => void;
  onAllMichigan: () => void;
}) {
  const loc = data.location;
  const currentRadius = loc?.radius ?? null;
  const nextRadius = loc && loc.kind !== "county" && currentRadius ? RADII.find((r) => r > currentRadius) ?? null : null;
  const filterCount = activeFilterCount(params);
  return (
    <div className="rounded-xl border border-primary/30 bg-secondary p-5">
      <h2 className="text-2xl font-bold">{zeroAll ? "No exact matches found." : "We couldn't find an exact match in this area."}</h2>
      <p className="mt-2 max-w-prose text-foreground">
        {zeroAll
          ? "Try different words, a wider area, or fewer filters. You can also tell us what you were looking for — it helps MittenLink find and add missing resources."
          : `Nothing matched ${loc ? (loc.kind === "county" ? `in ${loc.label}` : `within ${loc.radius} miles of ${loc.label}`) : "nearby"}. ${
              hasStatewide ? "The statewide and virtual resources below match your search and are available to you." : ""
            }`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {nextRadius && (
          <Button onClick={() => onExpand(nextRadius)}>Expand search radius to {nextRadius} miles</Button>
        )}
        {filterCount > 0 && (
          <Button variant="outline" onClick={onRemoveFilters}>
            Remove filters
          </Button>
        )}
        {hasStatewide ? (
          <a href="#statewide-results" className={buttonVariants({ variant: "outline" })}>
            View statewide resources
          </a>
        ) : (
          loc && (
            <Button variant="outline" onClick={onAllMichigan}>
              View statewide resources
            </Button>
          )
        )}
        <Link href="/suggest?type=resource" className={buttonVariants({ variant: "outline" })}>
          Suggest a resource
        </Link>
        <Link href={suggestNeedHref} className={buttonVariants({ variant: "outline" })}>
          Tell MittenLink what you were looking for
        </Link>
      </div>
    </div>
  );
}

function HiddenFilterInputs({ params, exclude = [], only }: { params: SearchParams; exclude?: string[]; only?: string[] }) {
  const entries = [...new URLSearchParams(toQueryString(params, { page: 1 })).entries()].filter(
    ([k]) => !exclude.includes(k) && (!only || only.includes(k)),
  );
  return (
    <>
      {entries.map(([k, v], i) => (
        <input key={`${k}-${v}-${i}`} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

interface Chip {
  key: string;
  label: string;
  remove: (p: SearchParams) => SearchParams;
}

function buildChips(p: SearchParams, options: FilterOptions): Chip[] {
  const chips: Chip[] = [];
  const name = (list: { slug: string; name: string }[], slug: string) => list.find((x) => x.slug === slug)?.name ?? slug.replace(/-/g, " ");
  if (p.location) chips.push({ key: "location", label: `Near ${p.location}`, remove: (x) => ({ ...x, location: "", radius: null }) });
  for (const k of p.kind) chips.push({ key: `kind-${k}`, label: KIND_PLURAL[k], remove: (x) => ({ ...x, kind: x.kind.filter((v) => v !== k) }) });
  for (const c of p.category) chips.push({ key: `cat-${c}`, label: name(options.categories, c), remove: (x) => ({ ...x, category: x.category.filter((v) => v !== c) }) });
  for (const c of p.population) chips.push({ key: `pop-${c}`, label: name(options.populations, c), remove: (x) => ({ ...x, population: x.population.filter((v) => v !== c) }) });
  for (const c of p.delivery) chips.push({ key: `del-${c}`, label: DELIVERY_LABELS[c] ?? c, remove: (x) => ({ ...x, delivery: x.delivery.filter((v) => v !== c) }) });
  const flags: [keyof SearchParams, string][] = [
    ["verified", "Verified resources"],
    ["accepting", "Accepting new clients"],
    ["free", "Free services"],
    ["insurance", "Insurance accepted"],
    ["accessible", "Accessible location"],
  ];
  for (const [k, l] of flags) if (p[k]) chips.push({ key: k, label: l, remove: (x) => ({ ...x, [k]: false }) });
  if (p.language) chips.push({ key: "language", label: `Language: ${options.languages.find((l) => l.code === p.language)?.name ?? p.language}`, remove: (x) => ({ ...x, language: "" }) });
  if (p.orgType) chips.push({ key: "orgType", label: ORG_TYPE_LABELS[p.orgType] ?? p.orgType, remove: (x) => ({ ...x, orgType: "" }) });
  return chips;
}
