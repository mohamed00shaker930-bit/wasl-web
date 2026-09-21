import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage, ApiError } from "@/api/client";
import { fetchMerchantOrders, type CustomRequestRow, type MerchantOrder } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtRial, fmtDate, STATUS_LABEL, STATUS_ORDER } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/merchant/orders")({
  component: MerchantOrders,
});

const NEXT: Record<string, string> = {
  sent: "accepted", accepted: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered",
};
const PAY_LABEL: Record<string, string> = { wallet: "محفظة وصل", jeeb: "جيب", jawali: "جوالي", hasab: "حاسب", onecash: "ون كاش" };
const CREDIT_LABEL: Record<string, string> = { pending: "بانتظار القرار", approved: "مقبول", declined: "مرفوض" };

type CustomRequestItem = { r: CustomRequestRow; customerName: string | null };

function MerchantOrders() {
  const qc = useQueryClient();
  const { data: orders } = useQuery({
    queryKey: ["merchant-orders"],
    queryFn: () => fetchMerchantOrders({ limit: 200 }),
    refetchInterval: 10000,
  });
  const { data: customRequests } = useQuery({
    queryKey: ["merchant-custom-requests"],
    queryFn: () => http.get<CustomRequestItem[]>("/merchant/custom-requests"),
    refetchInterval: 10000,
  });

  // Customer name/phone per order (was rpc get_order_customer) — fetched lazily for the first 30 unseen orders.
  const [customers, setCustomers] = useState<Record<string, { name: string | null; phone: string | null }>>({});
  const requested = useRef(new Set<string>());
  useEffect(() => {
    (async () => {
      if (!orders) return;
      const missing = orders.filter((o) => !requested.current.has(o.id)).slice(0, 30);
      for (const o of missing) {
        requested.current.add(o.id);
        try {
          const row = await http.get<{ name: string | null; phone: string | null }>(`/merchant/orders/${o.id}/customer`);
          setCustomers((p) => ({ ...p, [o.id]: row }));
        } catch {
          /* customer may be deleted; keep the fallback text */
        }
      }
    })();
  }, [orders]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["merchant-orders"] });
    qc.invalidateQueries({ queryKey: ["merchant-credit"] });
    qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const updateStatus = (id: string, status: string) =>
    run(() => http.patch(`/merchant/orders/${id}/status`, { status }), "تم التحديث");
  // Credit orders: one call creates the account + approved charge and moves the order on (replaces the old direct table writes).
  const creditDecision = (id: string, approve: boolean) =>
    run(() => http.post(`/merchant/orders/${id}/credit-decision`, { approve }), approve ? "تم قبول الأجل" : "تم الرفض");

  // The API has no "which orders did I already rate" listing; remember what we rated this session and honour `already_rated`.
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [rateFor, setRateFor] = useState<MerchantOrder | null>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const submitRating = async () => {
    if (!rateFor) return;
    try {
      await http.post(`/merchant/orders/${rateFor.id}/customer-rating`, { stars, comment: comment || undefined });
      toast.success("تم تقييم العميل");
      setRatedIds((s) => new Set(s).add(rateFor.id));
      setRateFor(null); setStars(5); setComment("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rated") { setRatedIds((s) => new Set(s).add(rateFor.id)); setRateFor(null); }
      toast.error(errorMessage(e));
    }
  };

  const [quoteFor, setQuoteFor] = useState<CustomRequestRow | null>(null);
  const [quoteForm, setQuoteForm] = useState({ price: "", note: "" });
  const sendQuote = async () => {
    if (!quoteFor) return;
    if (!quoteForm.price) { toast.error("اكتب السعر"); return; }
    try {
      await http.post(`/merchant/custom-requests/${quoteFor.id}/quote`, { price: Number(quoteForm.price), note: quoteForm.note || null });
      toast.success("أُرسل السعر للعميل");
      setQuoteFor(null); setQuoteForm({ price: "", note: "" });
      qc.invalidateQueries({ queryKey: ["merchant-custom-requests"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const rejectRequest = async (id: string) => {
    try {
      await http.post(`/merchant/custom-requests/${id}/reject`);
      toast.success("تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["merchant-custom-requests"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const payLabel = (o: MerchantOrder) =>
    o.paymentMethod === "cash" ? "💵 نقداً"
      : o.paymentMethod === "credit" ? `📒 أجل (${CREDIT_LABEL[o.creditStatus ?? ""] ?? o.creditStatus ?? "—"})`
      : `👛 ${PAY_LABEL[o.paymentMethod] ?? o.paymentMethod}`;

  return (
    <MerchantShell title="الطلبات الواردة">
      <Tabs defaultValue="orders">
        <TabsList className="grid grid-cols-2 mb-3">
          <TabsTrigger value="orders">الطلبات ({orders?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="custom">طلبات خاصة ({customRequests?.filter((x) => x.r.status === "pending").length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-3">
          {orders?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا توجد طلبات.</Card>}
          {orders?.map((o) => {
            const stepIdx = STATUS_ORDER.indexOf(o.status as (typeof STATUS_ORDER)[number]);
            const nextStatus = NEXT[o.status];
            const isNewCredit = o.status === "sent" && o.paymentMethod === "credit" && o.creditStatus === "pending";
            const c = customers[o.id];
            const canRate = o.status === "delivered" && !ratedIds.has(o.id) && !(o as { customerRated?: boolean }).customerRated;
            return (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-bold">طلب #{o.id.slice(0, 6)}</p>
                    <p className="text-sm">{c?.name || "عميل"}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{c?.phone || o.locationPhone || "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</p>
                  </div>
                  <Badge variant={o.status === "delivered" ? "default" : o.status === "declined" ? "destructive" : "secondary"}>
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                {stepIdx >= 0 && (
                  <div className="flex gap-1">
                    {STATUS_ORDER.map((s, i) => <div key={s} className={`flex-1 h-1.5 rounded ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />)}
                  </div>
                )}
                <div className="text-sm space-y-1 bg-muted/30 rounded p-2">
                  {o.items?.map((it) => <div key={it.id} className="flex justify-between"><span>{it.name} × {it.qty}</span><span>{fmtRial(Number(it.price) * it.qty)}</span></div>)}
                </div>
                <div className="text-xs text-muted-foreground">
                  📍 {o.locationLandmark}
                  {o.note && <div className="mt-1">📝 {o.note}</div>}
                </div>
                <div className="flex justify-between items-center border-t pt-2">
                  <div className="text-sm">{payLabel(o)}</div>
                  <span className="font-bold text-primary">{fmtRial(o.total)}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {isNewCredit ? (
                    <>
                      <Button size="sm" onClick={() => creditDecision(o.id, true)} className="flex-1">قبول الأجل</Button>
                      <Button size="sm" variant="destructive" onClick={() => creditDecision(o.id, false)}>رفض</Button>
                    </>
                  ) : o.status === "sent" ? (
                    <>
                      <Button size="sm" onClick={() => updateStatus(o.id, "accepted")} className="flex-1">قبول</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(o.id, "declined")}>رفض</Button>
                    </>
                  ) : nextStatus ? (
                    <Button size="sm" onClick={() => updateStatus(o.id, nextStatus)} className="flex-1">
                      التالي: {STATUS_LABEL[nextStatus]}
                    </Button>
                  ) : null}
                  {canRate && (
                    <Button size="sm" variant="outline" onClick={() => { setRateFor(o); setStars(5); setComment(""); }}>
                      <Star className="w-4 h-4 ml-1" /> قيّم العميل
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          {customRequests?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا طلبات خاصة.</Card>}
          {customRequests?.map(({ r, customerName }) => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex justify-between">
                <div className="flex-1">
                  <p className="font-bold">{r.name}</p>
                  {customerName && <p className="text-xs text-muted-foreground">العميل: {customerName}</p>}
                  {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  <p className="text-xs text-muted-foreground">الكمية: {r.qty} · {fmtDate(r.createdAt)}</p>
                </div>
                <Badge variant={r.status === "pending" ? "secondary" : r.status === "accepted" || r.status === "converted" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>
                  {r.status === "pending" ? "جديد" : r.status === "quoted" ? "تم التسعير" : r.status === "accepted" ? "مقبول" : r.status === "rejected" ? "مرفوض" : "محوّل"}
                </Badge>
              </div>
              {r.imageUrl && <img src={r.imageUrl} className="w-24 h-24 object-cover rounded border" />}
              {r.merchantPrice && <p className="text-sm">سعرك: <span className="font-bold text-primary">{fmtRial(r.merchantPrice)}</span></p>}
              {r.merchantNote && <p className="text-xs text-muted-foreground">ملاحظتك: {r.merchantNote}</p>}
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setQuoteFor(r); setQuoteForm({ price: "", note: "" }); }}>أرسل سعر</Button>
                  <Button size="sm" variant="outline" onClick={() => rejectRequest(r.id)}>رفض</Button>
                </div>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rateFor} onOpenChange={(v) => !v && setRateFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تقييم العميل</DialogTitle></DialogHeader>
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

      <Dialog open={!!quoteFor} onOpenChange={(v) => !v && setQuoteFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إرسال سعر: {quoteFor?.name}</DialogTitle></DialogHeader>
          <div><Label>السعر للوحدة (ر.ي)</Label><Input dir="ltr" inputMode="numeric" value={quoteForm.price} onChange={(e) => setQuoteForm({...quoteForm, price: e.target.value})} /></div>
          <div><Label>ملاحظة (اختياري)</Label><Textarea rows={2} value={quoteForm.note} onChange={(e) => setQuoteForm({...quoteForm, note: e.target.value})} /></div>
          <Button onClick={sendQuote}>إرسال</Button>
        </DialogContent>
      </Dialog>
    </MerchantShell>
  );
}
