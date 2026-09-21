import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { http, errorMessage } from "@/api/client";
import type { AdminProfile } from "@/api/admin";
import { formatDateTime } from "@/lib/dateFormat";

export const Route = createFileRoute("/admin/account-requests")({
  component: AccountRequestsPage,
});

type Req = { p: AdminProfile; categoryName: string | null };

function AccountRequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await http.get<Req[]>("/admin/account-requests"));
    } catch (e) {
      toast.error(errorMessage(e));
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, approve: boolean, p_reason?: string) => {
    setBusy(true);
    try {
      await http.post(`/admin/account-requests/${id}/decide`, { approve, ...(approve || !p_reason ? {} : { reason: p_reason }) });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e));
      return;
    }
    setBusy(false);
    toast.success(approve ? "تمت الموافقة على الطلب" : "تم رفض الطلب");
    setRejecting(null); setReason("");
    load();
  };

  return (
    <AdminShell title="طلبات فتح الحساب">
      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات معلّقة</Card>
      ) : (
        <div className="space-y-3">
          {rows.map(({ p: r, categoryName }) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {r.userType === "merchant" ? "تاجر" : "مستهلك"}
                </span>
                <p className="font-bold">{r.name || "—"}</p>
                <span dir="ltr" className="text-sm text-muted-foreground">{r.phone}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <p>المدينة: {r.city || "—"}</p>
                <p>المديرية: {r.district || "—"}</p>
                <p className="col-span-2">العنوان: {r.address || "—"}</p>
                {r.userType === "merchant" && <p>اسم النشاط: {r.businessName || "—"}</p>}
                {r.userType === "merchant" && <p>نوع النشاط: {categoryName || "—"}</p>}
                <p className="col-span-2">تاريخ الطلب: {formatDateTime(r.createdAt)}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled={busy} onClick={() => decide(r.id, true)}>موافقة</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setRejecting({ p: r, categoryName }); setReason(""); }}>رفض</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>رفض الطلب</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">سبب الرفض (اختياري)</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="destructive" disabled={busy} onClick={() => rejecting && decide(rejecting.p.id, false, reason.trim())}>
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
