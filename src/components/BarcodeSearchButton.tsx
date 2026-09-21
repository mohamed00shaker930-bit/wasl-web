import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { http } from "@/api/client";

type BarcodeSearchButtonProps = {
  storeId: string;
  onFound: (productName: string) => void;
};

export function BarcodeSearchButton({ storeId, onFound }: BarcodeSearchButtonProps) {
  const [scanOpen, setScanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const onDetected = async (code: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const rows = await http.get<{ id: string; name: string }[]>(`/stores/${storeId}/products`, { barcode: code });
      const data = rows[0] ?? null;
      setScanOpen(false);
      if (!data) {
        toast.error("هذا الباركود غير موجود في منتجات هذا المتجر");
      } else {
        onFound(data.name);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("تعذّر البحث عن الباركود");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="h-11 w-11 rounded-lg bg-primary text-primary-foreground shadow-sm flex items-center justify-center shrink-0"
        aria-label="مسح الباركود للبحث عن منتج"
      >
        <ScanBarcode className="w-5 h-5" />
      </button>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={onDetected}
        title="مسح باركود المنتج"
      />
    </>
  );
}
