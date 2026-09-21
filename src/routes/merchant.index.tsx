import { fetchMyStore } from "@/lib/my-store";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/api/client";
import type { DashboardStats, StoreRow } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { fmtRial } from "@/lib/format";
import { ShoppingBag, Clock, Wallet, Star } from "lucide-react";

export const Route = createFileRoute("/merchant/")({
  component: MerchantDashboard,
});

function MerchantDashboard() {
  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await fetchMyStore()) as StoreRow | null,
  });
  const { data: stats } = useQuery({
    queryKey: ["merchant-dashboard"],
    queryFn: () => http.get<DashboardStats>("/merchant/dashboard"),
    refetchInterval: 30_000,
  });

  return (
    <MerchantShell title={store?.name || "متجري"}>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <ShoppingBag className="w-6 h-6 text-primary mb-2" />
          <p className="text-2xl font-bold">{stats?.new_orders ?? 0}</p>
          <p className="text-xs text-muted-foreground">طلبات جديدة</p>
        </Card>
        <Card className="p-4">
          <Clock className="w-6 h-6 text-warning mb-2" />
          <p className="text-2xl font-bold">{stats?.today_orders ?? 0}</p>
          <p className="text-xs text-muted-foreground">طلبات اليوم</p>
        </Card>
        <Card className="p-4">
          <Wallet className="w-6 h-6 text-success mb-2" />
          <p className="text-lg font-bold">{fmtRial(stats?.today_revenue ?? 0)}</p>
          <p className="text-xs text-muted-foreground">إيرادات اليوم</p>
        </Card>
        <Card className="p-4">
          <Star className="w-6 h-6 text-destructive mb-2" />
          <p className="text-lg font-bold">{fmtRial(stats?.credit_outstanding ?? 0)}</p>
          <p className="text-xs text-muted-foreground">ديون مستحقة</p>
        </Card>
      </div>
      <Card className="p-4 mt-4">
        <h3 className="font-bold mb-1">{store?.name}</h3>
        <p className="text-sm text-muted-foreground">{store?.area}</p>
        <p className="text-xs mt-2">{store?.isOpen ? "✅ المتجر مفتوح" : "🔴 المتجر مغلق"} — التقييم {Number(store?.rating ?? 0).toFixed(1)} ⭐</p>
        {(stats?.pending_returns ?? 0) > 0 && (
          <p className="text-xs mt-1 text-amber-600">↩️ {stats!.pending_returns} طلب إرجاع بانتظار الرد</p>
        )}
      </Card>
    </MerchantShell>
  );
}
