import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Crosshair, Loader2 } from "lucide-react";
import { requestCurrentPosition, type LatLng } from "@/lib/geo";
import { toast } from "sonner";

const BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

// Sana'a default
const DEFAULT_CENTER: LatLng = { lat: 15.3694, lng: 44.1910 };

declare global { interface Window { google: any; __initBaqalatiMap?: () => void; } }

let loaderPromise: Promise<void> | null = null;
function loadMapsApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("missing_key"));
  loaderPromise = new Promise((resolve, reject) => {
    window.__initBaqalatiMap = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initBaqalatiMap`;
    s.async = true; s.defer = true;
    s.onerror = () => reject(new Error("script_error"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export function MapPicker({
  open, onOpenChange, initial, onPick, title = "اختر الموقع على الخريطة",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: LatLng | null;
  onPick: (p: LatLng) => void;
  title?: string;
}) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pos, setPos] = useState<LatLng>(initial ?? DEFAULT_CENTER);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setErr(null); setLoading(true);
    loadMapsApi()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const start = initial ?? pos;
        const map = new window.google.maps.Map(mapDivRef.current, {
          center: start, zoom: 15, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        });
        const marker = new window.google.maps.Marker({ position: start, map, draggable: true });
        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) setPos({ lat: p.lat(), lng: p.lng() });
        });
        map.addListener("click", (e: any) => {
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(p); setPos(p);
        });
        mapRef.current = map; markerRef.current = marker;
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoading(false);
        setErr(e.message === "missing_key" ? "مفتاح الخرائط غير مهيّأ" : "تعذّر تحميل الخريطة");
      });
    return () => { cancelled = true; };
  }, [open]);

  const useMyLocation = async () => {
    try {
      const p = await requestCurrentPosition();
      setPos(p);
      if (mapRef.current && markerRef.current) {
        markerRef.current.setPosition(p);
        mapRef.current.panTo(p);
        mapRef.current.setZoom(16);
      }
      toast.success("تم تحديد موقعك");
    } catch (e: any) {
      toast.error("تعذّر تحديد الموقع — تأكد من السماح بإذن الموقع");
    }
  };

  const confirm = () => {
    onPick(pos);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> {title}</DialogTitle>
        </DialogHeader>
        <div className="relative h-[420px] bg-muted">
          <div ref={mapDivRef} className="absolute inset-0" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {err && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-destructive bg-background p-6 text-center">
              {err}
            </div>
          )}
          <Button
            type="button" size="sm" variant="secondary"
            onClick={useMyLocation}
            className="absolute bottom-3 left-3 shadow-lg"
          >
            <Crosshair className="w-4 h-4 ml-1" /> موقعي الحالي
          </Button>
        </div>
        <DialogFooter className="px-4 pb-4 flex flex-row gap-2 justify-between items-center">
          <div className="text-xs text-muted-foreground" dir="ltr">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
          </div>
          <Button onClick={confirm} disabled={!!err}>تأكيد الموقع</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
