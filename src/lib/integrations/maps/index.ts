import type { MapProvider, MapProviderId } from "./types";

export type { MapMarker, MapInstance, MapProvider, MapProviderId, MapCallbacks } from "./types";

/**
 * Selected map provider. NEXT_PUBLIC_MAP_PROVIDER=none disables maps (the
 * list stays fully functional). Add "mapbox" / "google" cases here with
 * their own adapter module implementing MapProvider.
 */
export function getMapProviderId(): MapProviderId {
  const configured = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "leaflet").toLowerCase();
  if (configured === "none" || configured === "off" || configured === "false") return "none";
  return "leaflet";
}

/** Dynamically load the provider (browser only). Returns null when maps are disabled. */
export async function loadMapProvider(id: MapProviderId = getMapProviderId()): Promise<MapProvider | null> {
  if (typeof window === "undefined") return null;
  switch (id) {
    case "leaflet": {
      const mod = await import("./leaflet");
      return mod.leafletProvider;
    }
    default:
      return null;
  }
}
