// Map provider abstraction. The search UI talks only to these interfaces so
// Leaflet/OpenStreetMap (default), Mapbox or Google Maps can be swapped in
// without touching search code. Providers are loaded client-side only.

export type MapProviderId = "leaflet" | "none";

export interface MapMarker {
  /** Listing id — several markers may share one id (multiple locations). */
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  /** Short visible label on the marker (e.g. result number). */
  badge?: string;
}

export interface MapCallbacks {
  /** A marker was activated (click / Enter). */
  onSelect: (id: string) => void;
  /** Tiles or the map library failed; the caller shows a list-only fallback. */
  onError: (reason: string) => void;
}

export interface MapInstance {
  setMarkers(markers: MapMarker[]): void;
  /** Pan to and highlight the marker(s) for a listing. */
  focusMarker(id: string): void;
  setActive(id: string | null): void;
  destroy(): void;
}

export interface MapProvider {
  id: Exclude<MapProviderId, "none">;
  /** Human-readable attribution for the text alternative. */
  name: string;
  createMap(container: HTMLElement, callbacks: MapCallbacks): Promise<MapInstance>;
}
