import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { snake } from "@/api/shape";
import { requireAuth } from "@/auth/guards";
import { useAppEvent } from "@/lib/realtime";
import { useCallback } from "react";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtRial, fmtDate, STATUS_LABEL, STATUS_ORDER } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Star, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  beforeLoad: () => requireAuth(),
  component: OrdersPage,
});

function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await http.get<any[]>("/me/orders").then(snake)).map((o: any) => ({ ...o, stores: o.store, order_items: o.items })),
    refetchInterval: 60000, // SSE below refreshes immediately; this is the fallback
  });
  useAppEvent("order.updated", useCallback(() => { qc.invalidateQueries({ queryKey: ["my-orders"] }); }, [qc]));
  const { data: customReqs } = useQuery({
    queryKey: ["my-custom-requests"],
    queryFn: async () => (await http.get<any[]>("/me/custom-requests").then(snake)).map((x: any) => ({ ...x.r, stores: { name: x.store_name } })),
    refetchInterval: 30000,
  });

  const [rateFor, setRateFor] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [returnFor, setReturnFor] = useState<any>(null);
  const [returnReason, setReturnReason] = useState("");

  const ratedOrders = new Set((orders ?? []).filter((o: any) => o.rated).map((o: any) => o.id));

  const submitRating = async () => {
    if (!rateFor) return;
    try {
      await http.post(`/me/orders/${rateFor.id}/rating`, { stars, comment: comment || undefined });
      toast.success("تم التقييم"); setRateFor(null); setStars(5); setComment(""); qc.invalidateQueries();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const respondRequest = async (id: string, accept: boolean) => {
    try {
      await http.post(`/me/custom-requests/${id}/${accept ? "accept" : "reject"}`);
      toast.success(accept ? "تم القبول — سيتواصل التاجر" : "تم الرفض"); qc.invalidateQueries();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const pendingQuotes = (customReqs ?? []).filter((r: any) => r.status === "quoted");

  return (
    <CustomerShell title="طلباتي">
      {pendingQuotes.length > 0 && (
        <Card className="p-4 mb-4 border-primary border-2">
          <p className="font-bold mb-2">عروض أسعار بانتظار ردك</p>
          <div className="space-y-3">
            {pendingQuotes.map((r: any) => (
              <div key={r.id} className="border-t pt-2 space-y-2">
                <div>
                  <p className="font-medium text-sm">{r.name} ({r.stores?.name})</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <div className="flex justify-between text-sm">
                  <span>الكمية: {r.qty}</span>
                  <span className="font-bold text-primary">{fmtRial(r.merchant_price)} للوحدة</span>
                </div>
                {r.merchant_note && <p className="text-xs text-muted-foreground">📝 {r.merchant_note}</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => respondRequest(r.id, true)}>قبول</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => respondRequest(r.id, false)}>رفض</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {orders?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا توجد طلبات بعد.</Card>}
        {orders?.map((o: any) => {
          const stepIdx = STATUS_ORDER.indexOf(o.status as any);
          const canRate = o.status === "delivered" && !ratedOrders.has(o.id);
          return (
            <Card key={o.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">{o.stores?.name}</h3>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</p>
                </div>
                <Badge variant={o.status === "delivered" ? "default" : o.status === "declined" ? "destructive" : "secondary"}>
                  {STATUS_LABEL[o.status]}
                </Badge>
              </div>
              {stepIdx >= 0 && (
                <div className="flex gap-1">
                  {STATUS_ORDER.map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
              )}
              <div className="text-xs space-y-1 text-muted-foreground">
                {o.order_items?.map((it: any) => <div key={it.id}>{it.name} × {it.qty}</div>)}
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm">{o.payment_method === "cash" ? "نقداً" : `أجل (${o.credit_status || "—"})`}</span>
                <span className="font-bold text-primary">{fmtRial(o.total)}</span>
              </div>
              {o.return_status && o.return_status !== "none" && (
                <div className={`text-xs p-2 rounded ${o.return_status === "approved" ? "bg-success/15 text-success" : o.return_status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                  إرجاع: {o.return_status === "requested" ? "بانتظار التاجر" : o.return_status === "approved" ? "تمت الموافقة" : "مرفوض"}
                  {o.return_reason && <span className="block opacity-80">{o.return_reason}</span>}
                </div>
              )}
              <div className="flex gap-2">
                {canRate && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setRateFor(o); setStars(5); setComment(""); }}>
                    <Star className="w-4 h-4 ml-1" /> قيّم
                  </Button>
                )}
                {o.status === "delivered" && (!o.return_status || o.return_status === "none") && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setReturnFor(o); setReturnReason(""); }}>
                    <Undo2 className="w-4 h-4 ml-1" /> طلب إرجاع
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>


      <Dialog open={!!rateFor} onOpenChange={(v) => !v && setRateFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تقييم التاجر</DialogTitle></DialogHeader>
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={() => setStars(n)}>
                <Star className={`w-8 h-8 ${n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
          <Textarea rows={3} placeholder="ملاحظة (اختياري)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button onClick={submitRating}>إرسال</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnFor} onOpenChange={(v) => !v && setReturnFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>طلب إرجاع</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">اشرح سبب رغبتك في إرجاع هذا الطلب — التاجر سيراجع الطلب ويقبله أو يرفضه.</p>
          <Textarea rows={3} placeholder="مثال: المنتج تالف / لم يصل المطلوب..." value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
          <Button onClick={async () => {
            if (!returnReason.trim()) { toast.error("اكتب سبب الإرجاع"); return; }
            try {
              await http.post(`/me/orders/${returnFor.id}/return`, { reason: returnReason });
              toast.success("تم إرسال طلب الإرجاع"); setReturnFor(null); qc.invalidateQueries();
            } catch (e) { toast.error(errorMessage(e)); }
          }}>إرسال طلب الإرجاع</Button>
        </DialogContent>
      </Dialog>
    </CustomerShell>
  );
}

