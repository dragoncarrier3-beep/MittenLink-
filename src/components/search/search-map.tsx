"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinOff } from "lucide-react";
import { getMapProviderId, loadMapProvider, type MapInstance, type MapMarker } from "@/lib/integrations/maps";

export const MAP_UNAVAILABLE = "The map is temporarily unavailable. You can continue browsing resources in the list.";

/**
 * Optional map of search results. Every mapped result is also in the list
 * next to it (the text alternative). Failure never affects search.
 */
export function SearchMap({
  markers,
  focusId,
  focusNonce,
  onSelect,
  onUnavailable,
}: {
  markers: MapMarker[];
  focusId: string | null;
  /** Changes whenever the same id should be focused again. */
  focusNonce: number;
  onSelect: (id: string) => void;
  onUnavailable?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed" | "disabled">(getMapProviderId() === "none" ? "disabled" : "loading");
  const onSelectRef = useRef(onSelect);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onUnavailableRef.current = onUnavailable;
  });

  useEffect(() => {
    if (getMapProviderId() === "none") return;
    let cancelled = false;
    let instance: MapInstance | null = null;
    const fail = () => {
      if (cancelled) return;
      setState("failed");
      onUnavailableRef.current?.();
    };
    const timeout = window.setTimeout(() => {
      if (!instance) fail();
    }, 15_000);
    (async () => {
      try {
        const provider = await loadMapProvider();
        if (cancelled || !containerRef.current) return;
        if (!provider) {
          setState("disabled");
          return;
        }
        instance = await provider.createMap(containerRef.current, {
          onSelect: (id) => onSelectRef.current(id),
          onError: () => fail(),
        });
        if (cancelled) {
          instance.destroy();
          return;
        }
        mapRef.current = instance;
        setState((s) => (s === "failed" ? s : "ready"));
      } catch (err) {
        console.warn("[map] failed to load", err);
        fail();
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (state === "ready") mapRef.current?.setMarkers(markers);
  }, [markers, state]);

  useEffect(() => {
    if (state !== "ready") return;
    if (focusId) mapRef.current?.focusMarker(focusId);
    else mapRef.current?.setActive(null);
  }, [focusId, focusNonce, state]);

  if (state === "disabled") {
    return (
      <div role="note" className="flex items-start gap-3 rounded-xl border bg-muted p-4 text-foreground">
        <MapPinOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p>The map view is turned off for this site. All results are available in the list.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "failed" ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-foreground">
          <MapPinOff className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>{MAP_UNAVAILABLE}</p>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            role="region"
            aria-label={`Map of ${markers.length} mapped location${markers.length === 1 ? "" : "s"}. The same results are listed next to the map.`}
            className="h-[22rem] w-full overflow-hidden rounded-xl border bg-muted lg:h-[calc(100vh-10rem)] lg:min-h-[28rem]"
          />
          {state === "loading" && (
            <p role="status" className="text-sm text-muted-foreground">
              Loading map…
            </p>
          )}
          {state === "ready" && markers.length === 0 && (
            <p className="text-sm text-muted-foreground">None of the results on this page have a physical location to map. They are listed below.</p>
          )}
        </>
      )}
    </div>
  );
}
