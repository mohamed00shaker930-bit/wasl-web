import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { fetchMerchantOrders, type MerchantOrder } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtRial, fmtDate } from "@/lib/format";
import { Undo2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/merchant/returns")({
  component: MerchantReturns,
});

const LABEL: Record<string, string> = { requested: "بانتظار الموافقة", approved: "مقبول", rejected: "مرفوض" };

function MerchantReturns() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["merchant-orders", "returns"],
    queryFn: async () => {
      // No dedicated returns endpoint: pull the store's recent orders and keep those with a return request.
      const rows = await fetchMerchantOrders({ limit: 500 });
      return rows
        .filter((o) => o.returnStatus !== "none")
        .sort((a, b) => (b.returnRequestedAt ?? b.createdAt).localeCompare(a.returnRequestedAt ?? a.createdAt));
    },
    refetchInterval: 15000,
  });

  const respond = async (id: string, approve: boolean) => {
    try {
      await http.post(`/merchant/orders/${id}/return-decision`, { approve });
      toast.success(approve ? "تمت الموافقة على الإرجاع" : "تم الرفض");
      qc.invalidateQueries({ queryKey: ["merchant-orders"] });
      qc.invalidateQueries({ queryKey: ["merchant-credit"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <MerchantShell title="المرتجعات">
      <div className="space-y-3">
        {(orders ?? []).length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <Undo2 className="w-10 h-10 mx-auto opacity-40 mb-2" />لا توجد طلبات إرجاع.
          </Card>
        )}
        {orders?.map((o: MerchantOrder) => (
          <Card key={o.id} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">طلب #{o.id.slice(0, 6)}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(o.returnRequestedAt || o.createdAt)}</p>
              </div>
              <Badge variant={o.returnStatus === "approved" ? "default" : o.returnStatus === "rejected" ? "destructive" : "secondary"}>
                {LABEL[o.returnStatus]}
              </Badge>
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              {o.items?.map((it) => <div key={it.id}>{it.name} × {it.qty}</div>)}
            </div>
            {o.returnReason && (
              <div className="text-sm bg-accent/30 p-2 rounded">
                <span className="font-bold">السبب:</span> {o.returnReason}
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <span className="text-sm text-muted-foreground">قيمة الطلب</span>
              <span className="font-bold text-primary">{fmtRial(o.total)}</span>
            </div>
            {o.returnStatus === "requested" && (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => respond(o.id, true)}>
                  <Check className="w-4 h-4 ml-1" /> قبول
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => respond(o.id, false)}>
                  <X className="w-4 h-4 ml-1" /> رفض
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </MerchantShell>
  );
}
