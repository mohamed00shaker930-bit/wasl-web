import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import type { MerchantOrder, ReportSummary } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtRial } from "@/lib/format";
import { Download, Store as StoreIcon, ShoppingBag, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { usePosSync } from "@/lib/pos-outbox";
import { toast } from "sonner";

export const Route = createFileRoute("/merchant/reports")({
  component: Reports,
});

type Range = "today" | "yesterday" | "7d" | "30d";

const RANGES: { id: Range; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "yesterday", label: "أمس" },
  { id: "7d", label: "7 أيام" },
  { id: "30d", label: "30 يوم" },
];

const PAY_LABEL: Record<string, string> = {
  cash: "نقداً", credit: "آجل", wallet: "محفظة وصل", jeeb: "جيب", jawali: "جوالي", hasab: "حاسب", onecash: "ون كاش",
};

function rangeBounds(r: Range): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (r === "today") return { from: start, to: now };
  if (r === "yesterday") {
    const y = new Date(start); y.setDate(y.getDate() - 1);
    return { from: y, to: start };
  }
  const days = r === "7d" ? 7 : 30;
  const from = new Date(start); from.setDate(from.getDate() - (days - 1));
  return { from, to: now };
}

function Reports() {
  const [range, setRange] = useState<Range>("today");
  const { pendingCount } = usePosSync();
  const bounds = useMemo(() => {
    const { from, to } = rangeBounds(range);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range]);

  // Aggregation moved server-side.
  const { data: summary } = useQuery({
    queryKey: ["reports-summary", range],
    queryFn: () => http.get<ReportSummary>("/merchant/reports/summary", bounds),
  });
  // Row-level list: per-channel revenue (the summary only carries channel counts) and the CSV export.
  const { data: orders } = useQuery({
    queryKey: ["reports-orders", range],
    queryFn: () => http.get<MerchantOrder[]>("/merchant/reports/orders", bounds),
  });

  const channel = useMemo(() => {
    const delivered = (orders ?? []).filter((o) => o.status === "delivered");
    const sum = (ch: MerchantOrder["channel"]) => delivered.filter((o) => o.channel === ch).reduce((s, o) => s + Number(o.total), 0);
    return { onlineTotal: sum("online"), inStoreTotal: sum("in_store") };
  }, [orders]);

  const stats = {
    total: summary?.revenue ?? 0,
    count: summary ? summary.orders - summary.cancelled : 0,
    avg: summary?.average_order ?? 0,
    onlineCount: summary?.online ?? 0,
    inStoreCount: summary?.in_store ?? 0,
    byPay: summary?.by_payment ?? {},
    top: summary?.top_products ?? [],
    ...channel,
  };

  const exportCSV = async () => {
    try {
      const rows = orders ?? (await http.get<MerchantOrder[]>("/merchant/reports/orders", bounds));
      if (!rows.length) { toast.error("لا بيانات للتصدير"); return; }
      const out = [["id", "date", "channel", "payment", "status", "total"]];
      for (const o of rows) {
        out.push([o.id, o.createdAt, o.channel, o.paymentMethod, o.status, String(o.total)]);
      }
      const csv = out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `sales-${range}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const maxChannel = Math.max(stats.onlineTotal, stats.inStoreTotal, 1);

  return (
    <MerchantShell title="التقارير" action={
      <Button size="sm" variant="secondary" onClick={exportCSV}><Download className="w-4 h-4 ml-1" /> CSV</Button>
    }>
      {pendingCount > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">
          <Clock className="w-4 h-4 shrink-0" />
          <span>يوجد {pendingCount} فاتورة بانتظار المزامنة ولن تظهر في التقرير حتى اكتمالها.</span>
        </div>
      )}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        {RANGES.map((r) => (
          <Button key={r.id} size="sm" variant={range === r.id ? "default" : "outline"} onClick={() => setRange(r.id)}>
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
          <p className="text-xl font-bold text-primary">{fmtRial(stats.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">عدد الفواتير</p>
          <p className="text-xl font-bold">{stats.count}</p>
        </Card>
        <Card className="p-4 col-span-2">
          <p className="text-xs text-muted-foreground">متوسط الفاتورة</p>
          <p className="text-lg font-bold">{fmtRial(stats.avg)}</p>
        </Card>
      </div>

      <Card className="p-4 mb-3 space-y-3">
        <h3 className="font-bold text-sm">المبيعات حسب القناة</h3>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-1"><StoreIcon className="w-3 h-3" /> داخل المحل ({stats.inStoreCount})</span>
            <span className="font-bold">{fmtRial(stats.inStoreTotal)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${(stats.inStoreTotal / maxChannel) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> أونلاين ({stats.onlineCount})</span>
            <span className="font-bold">{fmtRial(stats.onlineTotal)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-success" style={{ width: `${(stats.onlineTotal / maxChannel) * 100}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-3">
        <h3 className="font-bold text-sm mb-2">حسب طريقة الدفع</h3>
        <div className="space-y-1 text-sm">
          {Object.keys(stats.byPay).length === 0 && <p className="text-xs text-muted-foreground">لا بيانات</p>}
          {Object.entries(stats.byPay).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b py-1">
              <span>{PAY_LABEL[k] ?? k} <span className="text-xs text-muted-foreground">({v.count})</span></span>
              <span className="font-bold">{fmtRial(v.total)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold text-sm mb-2">أعلى المنتجات مبيعاً</h3>
        <div className="space-y-1 text-sm">
          {stats.top.length === 0 && <p className="text-xs text-muted-foreground">لا بيانات</p>}
          {stats.top.map((p, i) => (
            <div key={i} className="flex justify-between border-b py-1">
              <span>{i + 1}. {p.name} <span className="text-xs text-muted-foreground">({p.qty})</span></span>
              <span className="font-bold">{fmtRial(p.total)}</span>
            </div>
          ))}
        </div>
      </Card>
    </MerchantShell>
  );
}
