import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { requireAuth } from "@/auth/guards";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Map as MapIcon } from "lucide-react";
import { useState } from "react";
import { MapPicker } from "@/components/MapPicker";
import type { LatLng } from "@/lib/geo";
import { toast } from "sonner";

export const Route = createFileRoute("/locations")({
  beforeLoad: () => requireAuth(),
  component: LocationsPage,
});

function LocationsPage() {
  const qc = useQueryClient();
  const { data: locs } = useQuery({
    queryKey: ["locations"],
    queryFn: () => http.get<any[]>("/me/locations"), // already ordered newest first
  });

  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({ label: "المنزل", landmark_text: "", phone: "" });
  const [coords, setCoords] = useState<LatLng | null>(null);

  const reset = () => { setForm({ label: "المنزل", landmark_text: "", phone: "" }); setCoords(null); };

  const save = async () => {
    if (!form.landmark_text.trim()) { toast.error("اكتب وصف المعلم"); return; }
    try {
      await http.post("/me/locations", {
        label: form.label || "موقع",
        landmark_text: form.landmark_text,
        phone: form.phone || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    } catch (e) { toast.error(errorMessage(e)); return; }
    toast.success("تم حفظ الموقع"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["locations"] });
  };

  const remove = async (id: string) => {
    try { await http.del(`/me/locations/${id}`); }
    catch (e) { toast.error(errorMessage(e)); return; }
    toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["locations"] });
  };

  return (
    <CustomerShell title="مواقعي المحفوظة" action={
      <Button size="sm" variant="secondary" onClick={() => { reset(); setOpen(true); }}>
        <Plus className="w-4 h-4 ml-1" /> جديد
      </Button>
    }>
      <div className="space-y-3">
        {(locs ?? []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <MapPin className="w-10 h-10 mx-auto opacity-40 mb-2" />
            لا توجد مواقع محفوظة. أضف موقع منزلك أو عملك.
          </Card>
        )}
        {locs?.map((l: any) => (
          <Card key={l.id} className="p-3 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{l.label}</div>
              <div className="text-sm text-muted-foreground truncate">{l.landmarkText}</div>
              {l.phone && <div className="text-xs text-muted-foreground" dir="ltr">{l.phone}</div>}
              {l.lat && l.lng && <div className="text-[10px] text-muted-foreground" dir="ltr">{Number(l.lat).toFixed(4)}, {Number(l.lng).toFixed(4)}</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(l.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة موقع</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="المنزل / العمل / ..." /></div>
            <div><Label>وصف المعلم</Label><Input value={form.landmark_text} onChange={(e) => setForm({ ...form, landmark_text: e.target.value })} placeholder="بجانب جامع النور — شارع 30" /></div>
            <div><Label>رقم الجوال للتواصل</Label><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
              <MapIcon className="w-4 h-4 ml-1" />
              {coords ? `📍 محدد (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : "اختيار الموقع على الخريطة"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={save} className="w-full">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MapPicker open={pickerOpen} onOpenChange={setPickerOpen} initial={coords} onPick={setCoords} />
    </CustomerShell>
  );
}
