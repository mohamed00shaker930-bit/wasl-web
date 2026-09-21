import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { http, errorMessage } from "@/api/client";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dateFormat";

export const Route = createFileRoute("/admin/orders")({ component: Page });

type AdminOrder = {
  id: string; total: string | number; commissionAmount: string | number | null; commissionPct: string | number | null;
  status: string; channel: string; paymentMethod: string; returnStatus: string; createdAt: string;
};
type Row = { o: AdminOrder; storeName: string | null };

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    (async () => {
      try {
        setRows(await http.get<Row[]>("/admin/orders", { status: filter === "all" ? undefined : filter, limit: 100 }));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    })();
  }, [filter]);
  return (
    <AdminShell title="كل الطلبات">
      <div className="flex gap-2 mb-3 flex-wrap">
        {["all", "sent", "accepted", "delivered", "cancelled"].map((s) => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "الكل" : s === "sent" ? "جديدة" : s === "accepted" ? "مقبولة" : s === "delivered" ? "مكتملة" : "ملغية"}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map(({ o, storeName }) => (
          <Card key={o.id} className="p-3">
            <div className="flex items-center gap-2 justify-between">
              <div>
                <p className="font-medium text-sm">{storeName || "متجر"}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
              </div>
              <div className="text-left">
                <p className="font-bold">{Number(o.total).toLocaleString()} ر.ي</p>
                <p className="text-[10px] text-muted-foreground">عمولة {Number(o.commissionAmount || 0).toLocaleString()} ({Number(o.commissionPct || 0)}%)</p>
              </div>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap">
              <Badge variant="outline">{o.status}</Badge>
              <Badge variant="outline">{o.channel === "online" ? "أونلاين" : "محل"}</Badge>
              <Badge variant="outline">{o.paymentMethod}</Badge>
              {o.returnStatus !== "none" && <Badge className="bg-red-100 text-red-700">إرجاع: {o.returnStatus}</Badge>}
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-muted-foreground py-8">لا طلبات</p>}
      </div>
    </AdminShell>
  );
}
