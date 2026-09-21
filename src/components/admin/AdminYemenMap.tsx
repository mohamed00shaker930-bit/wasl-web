import { useEffect, useRef } from "react";

declare global { interface Window { google: any; initAdminMap?: () => void; } }

let loaded = false;
let loadingPromise: Promise<void> | null = null;

function loadGoogle(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  loadingPromise = new Promise((resolve) => {
    (window as any).initAdminMap = () => { loaded = true; resolve(); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=visualization&callback=initAdminMap`;
    s.async = true;
    document.head.appendChild(s);
  });
  return loadingPromise;
}

export function AdminYemenMap({
  stores,
  orders,
  height = 380,
}: {
  stores: { id: string; name: string; lat: number | null; lng: number | null; status: string }[];
  orders: { lat: number | null; lng: number | null }[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: any; let cleanup: any[] = [];
    loadGoogle().then(() => {
      if (!ref.current || !window.google) return;
      map = new window.google.maps.Map(ref.current, {
        center: { lat: 15.55, lng: 47.5 },
        zoom: 6,
        streetViewControl: false,
        mapTypeControl: false,
      });
      stores.forEach((s) => {
        if (s.lat == null || s.lng == null) return;
        const m = new window.google.maps.Marker({
          position: { lat: s.lat, lng: s.lng }, map, title: s.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: s.status === "active" ? "#10b981" : s.status === "pending" ? "#f59e0b" : "#ef4444",
            fillOpacity: 0.95, strokeColor: "#fff", strokeWeight: 2,
          },
        });
        cleanup.push(m);
      });
      const pts = orders.filter((o) => o.lat != null && o.lng != null)
        .map((o) => new window.google.maps.LatLng(o.lat!, o.lng!));
      if (pts.length) {
        const heat = new window.google.maps.visualization.HeatmapLayer({ data: pts, radius: 22, opacity: 0.7 });
        heat.setMap(map);
        cleanup.push(heat);
      }
    });
    return () => { cleanup.forEach((m) => m.setMap && m.setMap(null)); };
  }, [stores, orders]);
  return <div ref={ref} style={{ height }} className="w-full rounded-lg border" />;
}
