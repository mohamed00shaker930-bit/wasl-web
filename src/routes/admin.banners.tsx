import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { http, errorMessage } from "@/api/client";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/banners")({ component: Page });

type Banner = {
  id: string; title: string; subtitle: string | null; imageUrl: string | null; link: string | null; bgColor: string | null;
  storeId: string | null; isActive: boolean; sortOrder: number; createdAt: string;
};

/** PUT /admin/banners/:id needs the full body; this maps a row back to the request shape. */
const toBody = (b: Banner) => ({
  title: b.title, subtitle: b.subtitle, image_url: b.imageUrl, link: b.link, bg_color: b.bgColor,
  store_id: b.storeId, is_active: b.isActive, sort_order: b.sortOrder,
});

function Page() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [title, setTitle] = useState("");
  const [image_url, setImg] = useState("");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setRows(await http.get<Banner[]>("/admin/banners"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useEffect(() => { load(); }, []);

  const pickImage = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const r = await http.upload<{ url: string }>("/admin/banners/images", f);
      setImg(r.url);
      toast.success("تم رفع الصورة");
    } catch (e) {
      toast.error(errorMessage(e, "فشل الرفع"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const add = async () => {
    if (!image_url.trim()) { toast.error("أدخل رابط الصورة"); return; }
    try {
      // the API requires a non-empty title; fall back to a generic one when the optional field is left blank
      await http.post("/admin/banners", { title: title.trim() || "بانر", image_url: image_url.trim(), link: link.trim() || null, is_active: true });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("تمت الإضافة");
    setTitle(""); setImg(""); setLink("");
    load();
  };

  const toggle = async (b: Banner) => {
    try {
      await http.put(`/admin/banners/${b.id}`, { ...toBody(b), is_active: !b.isActive });
    } catch (e) {
      toast.error(errorMessage(e));
    }
    load();
  };
  const del = async (id: string) => {
    if (!confirm("حذف هذا البانر؟")) return;
    try {
      await http.del(`/admin/banners/${id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    load();
  };

  return (
    <AdminShell title="البانرات">
      <Card className="p-4 space-y-3 mb-4">
        <div><Label>عنوان (اختياري)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div>
          <Label>رابط الصورة</Label>
          <div className="flex gap-2">
            <Input value={image_url} onChange={(e) => setImg(e.target.value)} placeholder="https://..." />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4 ml-1" />{uploading ? "جاري الرفع..." : "رفع"}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div><Label>رابط داخلي (اختياري)</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/store/..." /></div>
        <Button onClick={add} className="w-full">إضافة بانر</Button>
      </Card>
      <div className="space-y-2">
        {rows.map((b) => (
          <Card key={b.id} className="p-2 flex items-center gap-3">
            <img src={b.imageUrl ?? undefined} className="w-20 h-12 object-cover rounded" />
            <div className="flex-1">
              <p className="text-sm font-medium">{b.title || "بدون عنوان"}</p>
              <p className="text-xs text-muted-foreground truncate">{b.link || "—"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => toggle(b)}>{b.isActive ? "إخفاء" : "إظهار"}</Button>
            <Button size="sm" variant="ghost" onClick={() => del(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">لا بانرات</p>}
      </div>
    </AdminShell>
  );
}
