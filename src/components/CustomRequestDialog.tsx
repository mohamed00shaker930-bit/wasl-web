import { useState } from "react";
import { http, errorMessage } from "@/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
}

export function CustomRequestDialog({ open, onClose, storeId }: Props) {
  const [form, setForm] = useState({ name: "", description: "", qty: "1" });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 3 * 1024 * 1024) { toast.error("الصورة كبيرة جداً (الحد 3 ميجا)"); return; }
    setUploading(true);
    try {
      const { url } = await http.upload<{ url: string }>("/files/custom-requests", file);
      setImageUrl(url);
    } catch (e) { toast.error(errorMessage(e, "تعذر رفع الصورة")); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("اكتب اسم المنتج"); return; }
    setSaving(true);
    try {
      await http.post("/me/custom-requests", {
        store_id: storeId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        qty: Number(form.qty) || 1,
        image_url: imageUrl || null,
      });
      toast.success("أُرسل الطلب للتاجر");
      setForm({ name: "", description: "", qty: "1" }); setImageUrl("");
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>طلب منتج غير موجود</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>اسم المنتج</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="مثلاً: حليب بقري كامل الدسم" /></div>
          <div><Label>الوصف (اختياري)</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="الماركة، الحجم، أي تفاصيل..." /></div>
          <div><Label>الكمية</Label><Input dir="ltr" inputMode="numeric" value={form.qty} onChange={(e) => setForm({...form, qty: e.target.value})} /></div>
          <div className="space-y-2">
            <Label>صورة (اختياري)</Label>
            {imageUrl ? (
              <div className="relative w-28 h-28 rounded-lg overflow-hidden border">
                <img src={imageUrl} className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImageUrl("")} className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 border border-dashed rounded cursor-pointer hover:bg-accent">
                <Camera className="w-4 h-4" />
                <span className="text-sm">{uploading ? "جارٍ الرفع..." : "إرفاق صورة"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            )}
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">{saving ? "جارٍ الإرسال..." : "إرسال للتاجر"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
