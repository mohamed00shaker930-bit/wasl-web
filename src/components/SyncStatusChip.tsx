import { useState } from "react";
import { usePosSync, listPending, retryFailed, flush } from "@/lib/pos-outbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wifi, WifiOff, RefreshCw, Clock } from "lucide-react";
import { fmtRial } from "@/lib/format";
import { formatDateTime } from "@/lib/dateFormat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PAY_LABEL: Record<string, string> = {
  cash: "نقداً", credit: "آجل", jeeb: "جيب", jawali: "جوالي", hasab: "حاسب", onecash: "ون كاش",
};

export function SyncStatusChip() {
  const { isOnline, pendingCount, syncing } = usePosSync();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: pending = [], refetch } = useQuery({
    queryKey: ["pos-outbox-pending", pendingCount, open],
    queryFn: () => listPending(),
    enabled: open,
  });

  const doFlush = async () => {
    const r = await flush();
    await refetch();
    qc.invalidateQueries({ queryKey: ["pos-outbox-pending"] });
    if (r.success === 0 && r.failed === 0) toast.info("لا شيء للمزامنة الآن");
  };
  const doRetry = async () => {
    await retryFailed();
    await refetch();
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-1 ${
          isOnline ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}
      >
        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {isOnline ? "متصل" : "بلا اتصال — يعمل محلياً"}
      </span>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-1 bg-primary/20 text-primary-foreground border border-primary/40"
        >
          <Clock className="w-3 h-3" />
          بانتظار المزامنة: {pendingCount}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>الفواتير بانتظار المزامنة</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" onClick={doFlush} disabled={syncing || !isOnline}>
              <RefreshCw className={`w-4 h-4 ml-1 ${syncing ? "animate-spin" : ""}`} /> مزامنة الآن
            </Button>
            <Button size="sm" variant="outline" onClick={doRetry} disabled={syncing || !isOnline}>
              إعادة محاولة الفاشلة
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-2 mt-2">
            {pending.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">لا توجد فواتير معلّقة</p>
            )}
            {pending.map((op) => {
              const order = op.payload?.order;
              const isProduct = op.kind === "new_product";
              return (
                <div key={op.id} className="border rounded p-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {isProduct ? `منتج جديد: ${op.payload?.name ?? "—"}` : `فاتورة ${formatDateTime(op.createdAt)}`}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${op.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-muted"}`}>
                      {op.status === "failed" ? "فشلت" : "معلّقة"}
                    </span>
                  </div>
                  {!isProduct && order && (
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{PAY_LABEL[order.payment_method] ?? order.payment_method}</span>
                      <span className="text-primary font-bold">{fmtRial(order.total ?? 0)}</span>
                    </div>
                  )}
                  {op.lastError && <p className="text-[10px] text-destructive mt-1 break-all">{op.lastError}</p>}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
