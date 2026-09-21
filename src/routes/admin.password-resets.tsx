import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { http, errorMessage } from "@/api/client";
import { formatDateTime } from "@/lib/dateFormat";

export const Route = createFileRoute("/admin/password-resets")({
  component: PasswordResetsPage,
});

type Row = {
  id: string; phone: string; applicantName: string | null; userType: string | null;
  reason: string | null; status: string; requestedAt: string; decidedAt: string | null;
};

const statusLabel: Record<string, string> = {
  pending: "معلّق", approved: "تمت الموافقة", rejected: "مرفوض",
};

function PasswordResetsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Row | null>(null);
  const [temp, setTemp] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // no status filter: the list shows every request (pending first by date), as before
      setRows(await http.get<Row[]>("/admin/password-resets"));
    } catch (e) {
      toast.error(errorMessage(e));
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!approving || temp.length < 6 || temp.length > 50) return;
    setBusy(true);
    try {
      await http.post(`/admin/password-resets/${approving.id}/decide`, { approve: true, temp_password: temp });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e));
      return;
    }
    setBusy(false);
    toast.success("تمت الموافقة — سلّم كلمة المرور المؤقتة للمستخدم خارج التطبيق");
    setApproving(null); setTemp("");
    load();
  };

  const reject = async (id: string) => {
    setBusy(true);
    try {
      await http.post(`/admin/password-resets/${id}/decide`, { approve: false });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e));
      return;
    }
    setBusy(false);
    toast.success("تم رفض الطلب");
    load();
  };

  return (
    <AdminShell title="طلبات إعادة تعيين كلمة المرور">
      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">{r.applicantName || "—"}</p>
                <span dir="ltr" className="text-sm text-muted-foreground">{r.phone}</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-muted">
                  {r.userType === "merchant" ? "تاجر" : r.userType === "customer" ? "مستهلك" : "—"}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {statusLabel[r.status] ?? r.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">التاريخ: {formatDateTime(r.requestedAt)}</p>
              {r.reason && <p className="text-xs text-muted-foreground">السبب: {r.reason}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" disabled={busy} onClick={() => { setApproving(r); setTemp(""); }}>موافقة</Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => reject(r.id)}>رفض</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!approving} onOpenChange={(o) => !o && setApproving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>كلمة المرور المؤقتة</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>كلمة المرور المؤقتة (6–50)</Label>
            <Input dir="ltr" value={temp} onChange={(e) => setTemp(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              تأكد من تسليم كلمة المرور المؤقتة للمستخدم خارج التطبيق، وسيُطلب منه تغييرها عند أول دخول.
            </p>
          </div>
          <DialogFooter>
            <Button disabled={busy || temp.length < 6 || temp.length > 50} onClick={approve}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
