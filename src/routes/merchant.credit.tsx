import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import type { CreditAccountDetail, CreditAccountRow } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtRial, fmtDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { totalDebt } from "@/lib/credit-rules";

export const Route = createFileRoute("/merchant/credit")({
  component: MerchantCredit,
});

function MerchantCredit() {
  const qc = useQueryClient();
  // Names/phones come with the list now (was one get_credit_customer RPC per account).
  const { data: accounts } = useQuery({
    queryKey: ["merchant-credit"],
    queryFn: () => http.get<CreditAccountRow[]>("/merchant/credit/accounts"),
    refetchInterval: 30_000,
  });

  const [openFor, setOpenFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const addPayment = async () => {
    if (!openFor || !amount) return;
    try {
      await http.post(`/merchant/credit/accounts/${openFor}/transactions`, { type: "payment", amount: Number(amount), note: note || null });
      toast.success("تم تسجيل الدفعة");
      setOpenFor(null); setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["merchant-credit"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const debt = totalDebt((accounts ?? []).map((a) => ({ id: a.id, customer_id: a.customerId, balance: a.balance })));

  return (
    <MerchantShell title="دفتر الأجل">
      <Card className="p-4 mb-4 bg-foreground text-background">
        <p className="text-xs opacity-70">إجمالي الديون المستحقة</p>
        <p className="text-2xl font-bold mt-1">{fmtRial(debt)}</p>
        <p className="text-[11px] mt-1 opacity-70">بدون فوائد — قاعدة شرعية</p>
      </Card>

      <div className="space-y-3">
        {accounts?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا توجد حسابات أجل.</Card>}
        {accounts?.map((a) => (
          <AccountCard key={a.id} account={a} onPay={() => setOpenFor(a.id)} />
        ))}
      </div>

      <Dialog open={!!openFor} onOpenChange={(v) => !v && setOpenFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
          <Input dir="ltr" placeholder="المبلغ" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={addPayment}>حفظ</Button>
        </DialogContent>
      </Dialog>
    </MerchantShell>
  );
}

/** The list endpoint carries no entries; each card loads its ledger from GET /merchant/credit/accounts/:id. */
function AccountCard({ account: a, onPay }: { account: CreditAccountRow; onPay: () => void }) {
  const qc = useQueryClient();
  const { data: detail } = useQuery({
    queryKey: ["merchant-credit", "account", a.id],
    queryFn: () => http.get<CreditAccountDetail>(`/merchant/credit/accounts/${a.id}`),
  });
  const txs = detail?.transactions ?? [];
  const pendingCnt = txs.filter((t) => t.status === "pending").length;

  const cancelTx = async (id: string) => {
    try {
      await http.post(`/merchant/credit/transactions/${id}/cancel`);
      toast.success("أُلغيت العملية");
      qc.invalidateQueries({ queryKey: ["merchant-credit"] });
      qc.invalidateQueries({ queryKey: ["merchant-orders"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="font-bold">{a.customerName || `عميل #${String(a.customerId).slice(0, 6)}`}</p>
          {a.customerPhone && <p className="text-xs text-muted-foreground" dir="ltr">{a.customerPhone}</p>}
        </div>
        <span className="font-bold text-primary">{fmtRial(a.balance)}</span>
      </div>
      {pendingCnt > 0 && <Badge variant="outline" className="mb-2 text-amber-600">{pendingCnt} بانتظار موافقة العميل</Badge>}
      <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
        {txs.slice(0, 6).map((t) => (
          <div key={t.id} className="flex justify-between items-center border-b last:border-0 py-1 gap-2">
            <span className={t.type === "charge" ? "text-destructive" : "text-success"}>
              {t.type === "charge" ? "مديونية" : "دفعة"}
              {t.status === "pending" && " (معلق)"}
              {t.status === "rejected" && " (مرفوض)"}
            </span>
            <span className="text-muted-foreground">{fmtDate(t.createdAt)}</span>
            <span>{fmtRial(t.amount)}</span>
            {t.status === "pending" && (
              <button type="button" className="text-[11px] text-destructive underline" onClick={() => cancelTx(t.id)}>إلغاء</button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" variant="outline" className="flex-1" onClick={onPay}>تسجيل دفعة</Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">المديونيات تُسجَّل فقط من نقطة البيع بعد موافقة العميل.</p>
    </Card>
  );
}
