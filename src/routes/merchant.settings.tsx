import { fetchMyStore } from "@/lib/my-store";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { auth } from "@/auth/store";
import type { StoreRow } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPicker } from "@/components/MapPicker";
import { MapPin, KeyRound, LogOut, Trash2, Camera } from "lucide-react";
import type { LatLng } from "@/lib/geo";

export const Route = createFileRoute("/merchant/settings")({
  component: MerchantSettings,
});

function MerchantSettings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: store } = useQuery({ queryKey: ["my-store"], queryFn: async () => (await fetchMyStore()) as StoreRow | null });
  const [form, setForm] = useState({ name: "", area: "", delivery_info: "", phone: "", is_open: true });
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name, area: store.area || "", delivery_info: store.deliveryInfo || "",
        phone: store.phone || "", is_open: store.isOpen,
      });
      if (store.lat != null && store.lng != null) {
        setCoords({ lat: Number(store.lat), lng: Number(store.lng) });
      }
    }
  }, [store]);

  const save = async () => {
    if (!store) return;
    const payload: Record<string, unknown> = {
      name: form.name.trim(), area: form.area || null, delivery_info: form.delivery_info || null,
      phone: form.phone || null, is_open: form.is_open,
    };
    if (coords) { payload.lat = coords.lat; payload.lng = coords.lng; }
    try {
      await http.patch("/merchant/store", payload);
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["my-store"] });
      void auth.refresh(); // me.store mirrors the store row
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("الصورة كبيرة جداً (الحد 5 ميجا)"); return; }
    setUploading(true);
    try {
      await http.upload("/merchant/store/image", file);
      toast.success("تم تحديث صورة المتجر");
      qc.invalidateQueries({ queryKey: ["my-store"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  };

  const signOut = async () => {
    await auth.logout();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await http.del("/me");
      await auth.logout();
      toast.success("تم حذف حسابك");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر حذف الحساب"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MerchantShell title="إعدادات المتجر">
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between p-3 bg-accent/30 rounded">
          <Label className="font-bold">المتجر مفتوح للطلبات</Label>
          <Switch checked={form.is_open} onCheckedChange={(v) => setForm({ ...form, is_open: v })} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex items-center justify-center text-2xl shrink-0">
            {store?.imageUrl ? <img src={store.imageUrl} className="w-full h-full object-cover" /> : "🏪"}
          </div>
          <div className="flex-1">
            <Label>صورة المتجر</Label>
            <Button type="button" size="sm" variant="outline" className="mt-1" disabled={uploading} onClick={() => imageRef.current?.click()}>
              <Camera className="w-4 h-4 ml-1" /> {uploading ? "جارٍ الرفع..." : "تغيير الصورة"}
            </Button>
            <input ref={imageRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </div>
        </div>
        <div><Label>اسم المتجر</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>الحي / المنطقة</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
        <div><Label>رقم الجوال</Label><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>معلومات التوصيل / الرسوم</Label><Textarea rows={3} value={form.delivery_info} onChange={(e) => setForm({ ...form, delivery_info: e.target.value })} /></div>
        <div>
          <Label>موقع المتجر على الخريطة</Label>
          <Button type="button" variant="outline" className="w-full mt-1" onClick={() => setPickerOpen(true)}>
            <MapPin className="w-4 h-4 ml-1" />
            {coords ? `محدد: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "اختر موقع متجرك"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1">يساعد العملاء على رؤية الأقرب وترتيب المتاجر بناءً على موقعهم.</p>
        </div>
        <Button onClick={save} className="w-full h-12">حفظ</Button>
      </Card>

      <Card className="p-4 mt-4 space-y-2">
        <h3 className="font-bold flex items-center gap-2 mb-1"><KeyRound className="w-4 h-4 text-primary" /> الحساب</h3>
        <Button asChild variant="outline" className="w-full">
          <Link to="/change-password">تغيير كلمة المرور</Link>
        </Button>
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
        </Button>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-4 h-4 ml-2" /> حذف الحساب
        </Button>
      </Card>

      <MapPicker open={pickerOpen} onOpenChange={setPickerOpen} initial={coords} onPick={setCoords} title="موقع متجرك" />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              لن تتمكن من الدخول بعد حذف حسابك، وتحتفظ الإدارة بسجلّ بذلك. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteAccount}>
              نعم، احذف حسابي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MerchantShell>
  );
}
