import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { http, errorMessage } from "@/api/client";
import { formatDateTime } from "@/lib/dateFormat";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/wallets")({ component: Page });

type WalletTx = { id: string; type: string; status: string; amount: string | number; method: string | null; reference: string | null; note: string | null; createdAt: string };
type Row = { t: WalletTx; userName: string | null; userPhone: string | null };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("pending");

  const load = async () => {
    try {
      setRows(await http.get<Row[]>("/admin/wallets/transactions", { status: filter === "all" ? undefined : filter, limit: 100 }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  useEffect(() => { load(); }, [filter]);

  const respond = async (id: string, approve: boolean) => {
    try {
      await http.post(`/admin/wallets/transactions/${id}/respond`, { approve });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success(approve ? "تمت الموافقة" : "تم الرفض");
    load();
  };

  return (
    <AdminShell title="المحافظ">
      <div className="flex gap-2 mb-3 flex-wrap">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "pending" ? "بانتظار" : s === "approved" ? "موافق عليها" : s === "rejected" ? "مرفوضة" : "الكل"}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map(({ t, userName, userPhone }) => (
          <Card key={t.id} className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-bold">{Number(t.amount).toLocaleString()} ر.ي</p>
                <p className="text-xs text-muted-foreground">{t.type} • {t.method || "—"}</p>
                {(userName || userPhone) && <p className="text-xs">{userName || "—"} {userPhone && <span dir="ltr" className="text-muted-foreground">{userPhone}</span>}</p>}
                {t.reference && <p className="text-xs text-muted-foreground">مرجع: {t.reference}</p>}
                {t.note && <p className="text-xs">{t.note}</p>}
                <p className="text-[10px] text-muted-foreground">{formatDateTime(t.createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="outline">{t.status}</Badge>
                {t.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => respond(t.id, true)}>موافقة</Button>
                    <Button size="sm" variant="destructive" onClick={() => respond(t.id, false)}>رفض</Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد عمليات</p>}
      </div>
    </AdminShell>
  );
}
