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
import { Badge } from "@/components/ui/badge";
import { fmtRial, fmtDate } from "@/lib/format";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { totalDebt, pendingCharges } from "@/lib/credit-rules";

export const Route = createFileRoute("/credit")({
  beforeLoad: () => requireAuth(),
  component: CreditPage,
});

function CreditPage() {
  const qc = useQueryClient();
  const { data: accounts } = useQuery({
    queryKey: ["credit"],
    queryFn: async () => (await http.get<any[]>("/me/credit").then(snake)).map((a: any) => ({ ...a, stores: a.store, credit_transactions: a.transactions })),
  });
  useAppEvent("credit_tx.updated", useCallback(() => { qc.invalidateQueries({ queryKey: ["credit"] }); }, [qc]));

  const debt = totalDebt((accounts ?? []) as any);
  const pendingTx = pendingCharges((accounts ?? []) as any);

  const respond = async (tx: any, approve: boolean) => {
    try { await http.post(`/me/credit/transactions/${tx.id}/respond`, { approve }); }
    catch (e) { toast.error(errorMessage(e)); return; }
    toast.success(approve ? "تمت الموافقة" : "تم الرفض");
    qc.invalidateQueries();
  };

  return (
    <CustomerShell title="دفتر الأجل">
      <Card className="p-4 mb-4 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">إجمالي المستحق عليك</p>
            <p className="text-2xl font-bold mt-1">{fmtRial(debt)}</p>
          </div>
          <Wallet className="w-10 h-10 opacity-50" />
        </div>
        <p className="text-[11px] mt-2 opacity-80">بدون فوائد أو غرامات تأخير — مبلغ ثابت</p>
      </Card>

      {pendingTx.length > 0 && (
        <Card className="p-4 mb-4 border-amber-500 border-2">
          <p className="font-bold text-amber-700 mb-2">طلبات مديونية بانتظار موافقتك</p>
          <div className="space-y-2">
            {pendingTx.map((t: any) => (
              <div key={t.id} className="border-t pt-2">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{t.storeName}</p>
                    <p className="text-xs text-muted-foreground">{t.note || "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                  </div>
                  <span className="font-bold">{fmtRial(t.amount)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => respond(t, true)}>قبول</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => respond(t, false)}>رفض</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {accounts?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا توجد حسابات أجل بعد.</Card>}
        {accounts?.map((a: any) => (
          <Card key={a.id} className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">{a.stores?.name}</h3>
              <span className="font-bold text-primary">{fmtRial(a.balance)}</span>
            </div>
            <div className="space-y-1 text-sm">
              {a.credit_transactions?.slice(0, 10).map((t: any) => (
                <div key={t.id} className="flex justify-between border-b last:border-0 py-1.5">
                  <span className={t.type === "charge" ? "text-destructive" : "text-success"}>
                    {t.type === "charge" ? "+ مديونية" : "- دفعة"}
                    {t.status !== "approved" && <Badge variant="outline" className="mr-1 text-[10px]">{t.status === "pending" ? "معلق" : "مرفوض"}</Badge>}
                  </span>
                  <span className="text-muted-foreground text-xs">{fmtDate(t.created_at)}</span>
                  <span className="font-medium">{fmtRial(t.amount)}</span>
                </div>
              ))}
              {!a.credit_transactions?.length && <p className="text-xs text-muted-foreground text-center py-2">لا حركات بعد</p>}
            </div>
          </Card>
        ))}
      </div>
    </CustomerShell>
  );
}
