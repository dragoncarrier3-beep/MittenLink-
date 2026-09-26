// Leaflet + OpenStreetMap tiles. Imported dynamically from the browser only.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapCallbacks, MapInstance, MapMarker, MapProvider } from "./types";

const MICHIGAN_CENTER: [number, number] = [44.3, -85.4];
const TILE_TIMEOUT_MS = 12_000;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export const leafletProvider: MapProvider = {
  id: "leaflet",
  name: "OpenStreetMap",
  async createMap(container: HTMLElement, callbacks: MapCallbacks): Promise<MapInstance> {
    const map = L.map(container, {
      center: MICHIGAN_CENTER,
      zoom: 6,
      scrollWheelZoom: false,
      keyboard: true,
      attributionControl: true,
    });

    let tilesLoaded = 0;
    let tileErrors = 0;
    let failed = false;
    const fail = (reason: string) => {
      if (failed) return;
      failed = true;
      callbacks.onError(reason);
    };
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    tiles.on("tileload", () => {
      tilesLoaded += 1;
    });
    tiles.on("tileerror", () => {
      tileErrors += 1;
      if (tilesLoaded === 0 && tileErrors >= 4) fail("tiles");
    });
    tiles.addTo(map);
    const timer = window.setTimeout(() => {
      if (tilesLoaded === 0) fail("timeout");
    }, TILE_TIMEOUT_MS);

    let layer = L.layerGroup().addTo(map);
    let byId = new Map<string, L.Marker[]>();
    let activeId: string | null = null;

    const iconFor = (m: MapMarker, active: boolean) =>
      L.divIcon({
        className: "",
        html: `<span class="ml-marker${active ? " is-active" : ""}" style="width:30px;height:30px">${escapeHtml(m.badge ?? "")}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -14],
      });

    const markerData = new Map<L.Marker, MapMarker>();

    const refreshIcons = () => {
      for (const [marker, data] of markerData) marker.setIcon(iconFor(data, data.id === activeId));
      for (const [marker, data] of markerData) {
        const el = marker.getElement();
        if (el) el.setAttribute("aria-pressed", String(data.id === activeId));
      }
    };

    return {
      setMarkers(markers: MapMarker[]) {
        layer.remove();
        layer = L.layerGroup().addTo(map);
        byId = new Map();
        markerData.clear();
        for (const m of markers) {
          const marker = L.marker([m.lat, m.lng], {
            icon: iconFor(m, m.id === activeId),
            title: m.title,
            alt: m.title,
            keyboard: true,
            riseOnHover: true,
          });
          marker.bindPopup(
            `<strong>${escapeHtml(m.title)}</strong>${m.subtitle ? `<br>${escapeHtml(m.subtitle)}` : ""}`,
          );
          marker.on("click", () => callbacks.onSelect(m.id));
          marker.on("keypress", (e: L.LeafletKeyboardEvent) => {
            if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") callbacks.onSelect(m.id);
          });
          marker.addTo(layer);
          markerData.set(marker, m);
          byId.set(m.id, [...(byId.get(m.id) ?? []), marker]);
        }
        if (markers.length) {
          const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
          map.fitBounds(bounds.pad(0.2), { maxZoom: 12 });
        } else {
          map.setView(MICHIGAN_CENTER, 6);
        }
        window.setTimeout(() => map.invalidateSize(), 50);
      },
      focusMarker(id: string) {
        const list = byId.get(id);
        if (!list?.length) return;
        activeId = id;
        refreshIcons();
        const first = list[0];
        map.setView(first.getLatLng(), Math.max(map.getZoom(), 11));
        first.openPopup();
      },
      setActive(id: string | null) {
        activeId = id;
        refreshIcons();
      },
      destroy() {
        window.clearTimeout(timer);
        map.remove();
      },
    };
  },
};
