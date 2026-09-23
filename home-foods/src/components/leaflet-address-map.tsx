"use client";

import { useEffect, useRef } from "react";

type LeafletEvent = { latlng: { lat: number; lng: number } };
type LeafletMap = { setView: (point: [number, number], zoom: number) => LeafletMap; on: (name: string, handler: (event: LeafletEvent) => void) => void; remove: () => void };
type Leaflet = { map: (node: HTMLElement, options?: Record<string, unknown>) => LeafletMap; tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void }; marker: (point: [number, number]) => { addTo: (map: LeafletMap) => { setLatLng: (point: [number, number]) => void } } };
declare global { interface Window { L?: Leaflet } }

let leafletLoader: Promise<Leaflet> | null = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise<Leaflet>((resolve, reject) => {
    if (!document.querySelector('link[data-homefoods-leaflet]')) {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; css.dataset.homefoodsLeaflet = "true"; document.head.append(css);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-homefoods-leaflet]');
    if (existing) { existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet did not load.")), { once: true }); existing.addEventListener("error", () => reject(new Error("The map library could not load.")), { once: true }); return; }
    const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true; script.dataset.homefoodsLeaflet = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet did not load."));
    script.onerror = () => reject(new Error("The map library could not load.")); document.head.append(script);
  }).catch((error: unknown) => { leafletLoader = null; throw error; });
  return leafletLoader;
}

export default function LeafletAddressMap({ onPick, center }: { onPick: (point: { latitude: number; longitude: number }) => void; center?: { latitude: number; longitude: number } }) {
  const node = useRef<HTMLDivElement>(null);
  const callback = useRef(onPick);
  const centerLatitude = center?.latitude;
  const centerLongitude = center?.longitude;

  useEffect(() => { callback.current = onPick; }, [onPick]);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let marker: { setLatLng: (point: [number, number]) => void } | null = null;
    let active = true;
    void loadLeaflet().then((leaflet) => {
      if (!active || !node.current) return;
      const start: [number, number] = centerLatitude !== undefined && centerLongitude !== undefined ? [centerLatitude, centerLongitude] : [60.1699, 24.9384];
      const hasCenter = centerLatitude !== undefined && centerLongitude !== undefined;
      map = leaflet.map(node.current, { scrollWheelZoom: false }).setView(start, hasCenter ? 15 : 11);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' }).addTo(map);
      if (hasCenter) marker = leaflet.marker(start).addTo(map);
      map.on("click", (event) => {
        const point: [number, number] = [event.latlng.lat, event.latlng.lng];
        if (marker) marker.setLatLng(point); else if (map) marker = leaflet.marker(point).addTo(map);
        callback.current({ latitude: point[0], longitude: point[1] });
      });
    }).catch((error: unknown) => { if (active && node.current) node.current.textContent = error instanceof Error ? error.message : "The map could not load."; });
    return () => { active = false; map?.remove(); };
  }, [centerLatitude, centerLongitude]);

  return <div className="leaflet-address-map" ref={node} role="application" aria-label="Interactive OpenStreetMap. Click to place the delivery address pin."/>;
}
