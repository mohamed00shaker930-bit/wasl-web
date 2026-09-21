import { createFileRoute } from "@tanstack/react-router";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { snake } from "@/api/shape";
import { requireAuth } from "@/auth/guards";
import { useAppEvent } from "@/lib/realtime";
import { useCallback } from "react";
import { useState } from "react";
import { formatDateTime } from "@/lib/dateFormat";
import { toast } from "sonner";
import { fmtRial } from "@/lib/format";
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/wallet")({ beforeLoad: () => requireAuth(), component: WalletPage });

const METHODS = [
  { id: "jeeb", name: "جيب", color: "#7c3aed" },
  { id: "jawali", name: "جوالي", color: "#dc2626" },
  { id: "hasab", name: "حساب", color: "#059669" },
  { id: "onecash", name: "ون كاش", color: "#ea580c" },
];

function WalletPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("jeeb");
  const [reference, setReference] = useState("");

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => http.get<{ id: string; balance: number }>("/me/wallet") });
  const { data: txs } = useQuery({ queryKey: ["wallet-tx"], queryFn: () => http.get<any[]>("/me/wallet/transactions", { limit: 50 }).then(snake) });
  useAppEvent("wallet_tx.updated", useCallback(() => { qc.invalidateQueries({ queryKey: ["wallet"] }); qc.invalidateQueries({ queryKey: ["wallet-tx"] }); }, [qc]));

  const submitTopup = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100) { toast.error("أدخل مبلغاً صحيحاً (100+ ر.ي)"); return; }
    if (!reference.trim()) { toast.error("أدخل رقم العملية"); return; }
    try { await http.post("/me/wallet/topups", { amount: amt, method, reference }); }
    catch (e) { toast.error(errorMessage(e)); return; }
    toast.success("تم إرسال طلب الشحن — بانتظار الموافقة");
    setOpen(false); setAmount(""); setReference("");
    qc.invalidateQueries({ queryKey: ["wallet-tx"] });
  };

  return (
    <CustomerShell title="المحفظة">
      <Card className="p-5 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2 opacity-90"><Wallet className="w-5 h-5" /><span className="text-sm">الرصيد المتاح</span></div>
        <p className="text-3xl font-extrabold mt-2">{fmtRial(Number(wallet?.balance ?? 0))}</p>
        <Button onClick={() => setOpen(true)} variant="secondary" className="mt-3 w-full"><Plus className="w-4 h-4 ml-1" />شحن المحفظة</Button>
      </Card>

      <div className="mt-4 space-y-2">
        <h3 className="font-bold">آخر العمليات</h3>
        {(txs ?? []).length === 0 && <Card className="p-6 text-center text-muted-foreground text-sm">لا توجد عمليات</Card>}
        {(txs ?? []).map((t: any) => {
          const isIn = t.type === "topup" || t.type === "refund";
          const StatusIcon = t.status === "approved" ? CheckCircle2 : t.status === "rejected" ? XCircle : Clock;
          return (
            <Card key={t.id} className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isIn ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {isIn ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {t.type === "topup" ? "شحن" : t.type === "payment" ? "دفع طلب" : t.type === "refund" ? "استرداد" : "تعديل"}
                  {t.method && <span className="text-xs text-muted-foreground"> • {t.method}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(t.created_at)}</p>
              </div>
              <div className="text-left">
                <p className={`font-bold ${isIn ? "text-success" : "text-destructive"}`}>{isIn ? "+" : "-"}{fmtRial(Number(t.amount))}</p>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground justify-end">
                  <StatusIcon className="w-3 h-3" />
                  {t.status === "approved" ? "مقبول" : t.status === "rejected" ? "مرفوض" : "بانتظار"}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>شحن المحفظة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>المبلغ (ر.ي)</Label><Input dir="ltr" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" /></div>
            <div>
              <Label>طريقة التحويل</Label>
              <div className="grid grid-cols-4 gap-2 mt-1">
                {METHODS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                    className={`p-2 rounded-xl border-2 text-xs font-medium transition ${method === m.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <div className="w-8 h-8 mx-auto mb-1 rounded-full text-white flex items-center justify-center font-bold" style={{ background: m.color }}>{m.name[0]}</div>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>رقم العملية / المرجع</Label><Input dir="ltr" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TXN..." /></div>
            <p className="text-[11px] text-muted-foreground">حوّل المبلغ إلى رقم المحفظة الرسمي للتطبيق ثم أدخل رقم العملية ليتم اعتمادها.</p>
            <Button onClick={submitTopup} className="w-full">إرسال طلب الشحن</Button>
          </div>
        </DialogContent>
      </Dialog>
    </CustomerShell>
  );
}
