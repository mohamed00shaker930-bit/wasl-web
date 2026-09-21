import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from "lucide-react";

export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  title = "مسح الباركود",
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("متصفحك لا يدعم الكاميرا. جرّب Chrome أو Safari.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => {});

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (cancelled) return;
          if (result) {
            const code = result.getText();
            try { navigator.vibrate?.(60); } catch {}
            onDetected(code);
          }
        });
        controlsRef.current = controls;
      } catch (e: any) {
        console.error("camera error", e);
        const msg = e?.name === "NotAllowedError"
          ? "لم يتم السماح للكاميرا. فعّل الإذن من إعدادات المتصفح."
          : e?.name === "NotFoundError"
          ? "لا توجد كاميرا متاحة على هذا الجهاز."
          : e?.message || "تعذّر فتح الكاميرا.";
        setError(msg);
      }
    };
    start();

    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const v = videoRef.current;
      if (v) { try { v.pause(); } catch {} v.srcObject = null; }
    };
  }, [open, onDetected, attempt]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 flex-row items-center justify-between">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative bg-black aspect-square">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <div className="absolute inset-8 border-2 border-primary/80 rounded-lg pointer-events-none" />
          {error && (
            <div className="absolute inset-0 bg-black/80 text-white flex flex-col items-center justify-center p-4 text-center gap-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-sm">{error}</p>
              <Button size="sm" variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                إعادة المحاولة
              </Button>
            </div>
          )}
        </div>
        <div className="p-3">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 ml-1" /> إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
