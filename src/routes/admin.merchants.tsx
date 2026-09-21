import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { http, errorMessage } from "@/api/client";
import type { AdminStore, BusinessCategory } from "@/api/admin";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/merchants")({
  component: Page,
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-700",
};

type Row = { s: AdminStore; ownerName: string | null; ownerPhone: string | null; categoryName: string | null };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<BusinessCategory[]>([]);
  const [editStore, setEditStore] = useState<AdminStore | null>(null);
  const [editCatId, setEditCatId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await http.get<Row[]>("/admin/stores", { status: filter === "all" ? undefined : filter }));
    } catch (e) {
      toast.error(errorMessage(e));
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const all = await http.get<BusinessCategory[]>("/admin/business-categories");
        setCats(all.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    })();
  }, []);

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id: string, status: string) => {
    try {
      await http.post(`/admin/stores/${id}/status`, { status });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("تم التحديث");
    load();
  };

  const setCommission = async (id: string, current: number | null) => {
    const raw = prompt("نسبة العمولة لهذا المتجر (٪)", current == null ? "" : String(current));
    if (raw === null) return;
    // the API needs an explicit percentage (0–100); it cannot reset a store back to the platform default
    if (raw.trim() === "") { toast.error("أدخل نسبة العمولة"); return; }
    const pct = Number(raw);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { toast.error("نسبة غير صحيحة"); return; }
    try {
      await http.post(`/admin/stores/${id}/commission`, { commission_pct: pct });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("تم تحديث العمولة");
    load();
  };

  const openEdit = (s: AdminStore) => {
    setEditStore(s);
    setEditCatId(s.businessCategoryId || "");
  };

  const saveEdit = async () => {
    if (!editStore) return;
    setSaving(true);
    try {
      await http.post(`/admin/stores/${editStore.id}/category`, { business_category_id: editCatId || null });
    } catch (e) {
      setSaving(false);
      toast.error(errorMessage(e));
      return;
    }
    setSaving(false);
    toast.success("تم حفظ التصنيف");
    setEditStore(null);
    load();
  };

  return (
    <AdminShell title="إدارة المتاجر">
      <div className="flex gap-2 mb-3 flex-wrap">
        {["pending", "active", "suspended", "rejected", "all"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "pending" ? "بانتظار" : s === "active" ? "مفعّلة" : s === "suspended" ? "معلّقة" : s === "rejected" ? "مرفوضة" : "الكل"}
          </Button>
        ))}
      </div>
      {loading ? <p className="text-center text-muted-foreground py-8">جاري التحميل...</p> :
        rows.length === 0 ? <p className="text-center text-muted-foreground py-8">لا توجد متاجر</p> :
        <div className="space-y-2">
          {rows.map(({ s, ownerName, ownerPhone, categoryName }) => {
            const commission = s.commissionPct == null ? null : Number(s.commissionPct);
            return (
              <Card key={s.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{s.name}</h3>
                      <Badge className={statusColor[s.status]}>{s.status}</Badge>
                      {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
                      {commission != null && <Badge variant="outline">عمولة {commission}%</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{s.area || "—"} • {s.phone || "بدون رقم"}</p>
                    {(ownerName || ownerPhone) && (
                      <p className="text-xs text-muted-foreground mt-0.5">المالك: {ownerName || "—"} {ownerPhone && <span dir="ltr">({ownerPhone})</span>}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {s.status !== "active" && <Button size="sm" onClick={() => setStatus(s.id, "active")}>اعتماد</Button>}
                  {s.status !== "suspended" && <Button size="sm" variant="outline" onClick={() => setStatus(s.id, "suspended")}>تعليق</Button>}
                  {s.status !== "rejected" && <Button size="sm" variant="destructive" onClick={() => setStatus(s.id, "rejected")}>رفض</Button>}
                  <Button size="sm" variant="secondary" onClick={() => setCommission(s.id, commission)}>تعديل العمولة</Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>تعديل التصنيف</Button>
                </div>
              </Card>
            );
          })}
        </div>
      }

      <Dialog open={!!editStore} onOpenChange={(o) => { if (!o) setEditStore(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل المحل — {editStore?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>تصنيف النشاط</Label>
              <Select value={editCatId || "__none__"} onValueChange={(v) => setEditCatId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون تصنيف</SelectItem>
                  {cats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStore(null)}>إلغاء</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
