import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ReportFilters, defaultRange, type ReportRange } from "@/components/admin/ReportFilters";
import { KpiCard } from "@/components/admin/KpiCard";
import { AdminYemenMap } from "@/components/admin/AdminYemenMap";
import { exportExcel, exportPdfPrint } from "@/lib/report-export";
import { http, errorMessage } from "@/api/client";
import { listUsers, type AdminStore } from "@/api/admin";
import { toast } from "sonner";
import {
  ShoppingBag, BadgeDollarSign, TrendingUp, Users, Package,
  AlertTriangle, Undo2, MapPin, Repeat,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

const COLORS = ["#0d9488", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#10b981", "#ec4899"];
const fmt = (n: number) => Number(n || 0).toLocaleString("ar");
const money = (n: number) => `${fmt(Math.round(Number(n || 0)))} ر.ي`;

/** Order row as the admin API returns it (camelCase, numeric columns as strings). */
type ApiOrder = {
  id: string; total: string | number; commissionAmount: string | number | null; commissionPct: string | number | null;
  status: string; channel: string; paymentMethod: string;
  customerId: string; storeId: string; createdAt: string;
  locationLat: string | number | null; locationLng: string | number | null;
  returnStatus: string; returnReason: string | null;
};
type OrderRow = {
  id: string; total: number; commissionAmount: number; commissionPct: number;
  status: string; channel: string; paymentMethod: string;
  customerId: string; storeId: string; createdAt: string;
  locationLat: number | null; locationLng: number | null;
  returnStatus: string; returnReason: string | null;
};
type StoreRow = { id: string; name: string; area: string | null; lat: number | null; lng: number | null; status: string; ownerId: string; rating: number | null; ratingCount: number | null };

const numOrNull = (v: string | number | null | undefined) => (v == null || v === "" ? null : Number(v));

function AnalyticsPage() {
  const [range, setRange] = useState<ReportRange>(defaultRange());
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string | null; phone: string }>>({});
  const [productAgg, setProductAgg] = useState<{ id: string; name: string; qty: number; revenue: number }[]>([]);
  const [stockOut, setStockOut] = useState<any[]>([]);
  const [slowProducts, setSlowProducts] = useState<any[]>([]);
  const [returnReasons, setReturnReasons] = useState<{ reason: string; count: number }[]>([]);

  const load = async () => {
    setLoading(true);
    const fromTs = new Date(range.from + "T00:00:00").toISOString();
    const toTs = new Date(range.to + "T23:59:59").toISOString();

    try {
      // Stores (for filter map)
      const storeRows = await http.get<{ s: AdminStore }[]>("/admin/stores");
      const storesData: StoreRow[] = storeRows.map(({ s }) => ({
        id: s.id, name: s.name, area: s.area, lat: numOrNull(s.lat), lng: numOrNull(s.lng), status: s.status, ownerId: s.ownerId,
        rating: numOrNull(s.rating), ratingCount: s.ratingCount,
      }));
      setStores(storesData);
      const storeMap = new Map(storesData.map((s) => [s.id, s]));
      const filterStoreIds = (id: string) => {
        if (range.storeId && id !== range.storeId) return false;
        if (range.city) {
          const s = storeMap.get(id); if (!s || s.area !== range.city) return false;
        }
        return true;
      };

      // Orders (channel/payment are narrowed client-side; the API filters by status/store/date only)
      const oData = await http.get<{ o: ApiOrder; storeName: string | null }[]>("/admin/orders", {
        from: fromTs, to: toTs, store_id: range.storeId || undefined, limit: 5000,
      });
      let rows: OrderRow[] = oData.map(({ o }) => ({
        id: o.id, total: Number(o.total || 0), commissionAmount: Number(o.commissionAmount || 0), commissionPct: Number(o.commissionPct || 0),
        status: o.status, channel: o.channel, paymentMethod: o.paymentMethod, customerId: o.customerId, storeId: o.storeId, createdAt: o.createdAt,
        locationLat: numOrNull(o.locationLat), locationLng: numOrNull(o.locationLng), returnStatus: o.returnStatus, returnReason: o.returnReason,
      }));
      if (range.channel !== "all") rows = rows.filter((r) => r.channel === range.channel);
      if (range.payment !== "all") rows = rows.filter((r) => r.paymentMethod === range.payment);
      if (range.city) rows = rows.filter((r) => filterStoreIds(r.storeId));
      setOrders(rows);

      // Customer profiles for top spenders (latest 200 customer accounts; names for the rest fall back to "—")
      const customerIds = new Set(rows.map((r) => r.customerId));
      if (customerIds.size) {
        const r = await listUsers({ kind: "customers", limit: 200, offset: 0 });
        const map: Record<string, { name: string | null; phone: string }> = {};
        r.items.forEach((p) => { map[p.id] = { name: p.name, phone: p.phone }; });
        setProfiles(map);
      } else setProfiles({});

      // Product aggregation: the admin API exposes no order_items feed; the KPI top-products list (delivered orders) stands in
      try {
        const k = await http.get<{ top_products: { name: string; qty: number; total: string | number }[] }>("/admin/kpis", { from: fromTs, to: toTs, grain: "day" });
        setProductAgg((k.top_products || []).map((p) => ({ id: p.name, name: p.name, qty: Number(p.qty || 0), revenue: Number(p.total || 0) })));
      } catch {
        setProductAgg([]);
      }

      // Returns reasons
      const ra = new Map<string, number>();
      rows.filter((r) => r.returnStatus && r.returnStatus !== "none").forEach((r) => {
        const k = r.returnReason || "بدون سبب";
        ra.set(k, (ra.get(k) || 0) + 1);
      });
      setReturnReasons(Array.from(ra.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count));

      // Stock-out / slow products need a cross-store product listing the admin API does not provide yet
      setStockOut([]);
      setSlowProducts([]);
    } catch (e) {
      toast.error(errorMessage(e));
    }

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.from, range.to, range.storeId, range.city, range.channel, range.payment]);

  // KPIs
  const totalSales = orders.reduce((a, o) => a + Number(o.total || 0), 0);
  const totalCommission = orders.reduce((a, o) => a + Number(o.commissionAmount || 0), 0);
  const netToMerchants = totalSales - totalCommission;
  const avgOrder = orders.length ? totalSales / orders.length : 0;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const returnsCount = orders.filter((o) => o.returnStatus && o.returnStatus !== "none").length;

  // Daily sales series
  const daily = useMemo(() => {
    const map = new Map<string, { day: string; sales: number; orders: number; commission: number }>();
    orders.forEach((o) => {
      const d = o.createdAt.slice(0, 10);
      const cur = map.get(d) || { day: d, sales: 0, orders: 0, commission: 0 };
      cur.sales += Number(o.total || 0);
      cur.commission += Number(o.commissionAmount || 0);
      cur.orders += 1;
      map.set(d, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [orders]);

  // By store
  const byStore = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; orders: number; commission: number; storeId: string }>();
    const sm = new Map(stores.map((s) => [s.id, s]));
    orders.forEach((o) => {
      const s = sm.get(o.storeId);
      const k = o.storeId;
      const cur = map.get(k) || { name: s?.name || "—", sales: 0, orders: 0, commission: 0, storeId: k };
      cur.sales += Number(o.total || 0);
      cur.commission += Number(o.commissionAmount || 0);
      cur.orders += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [orders, stores]);

  // By payment / channel pies
  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.paymentMethod, (map.get(o.paymentMethod) || 0) + Number(o.total || 0)));
    return Array.from(map.entries()).map(([k, v]) => ({ name: k, value: Math.round(v) }));
  }, [orders]);
  const byChannel = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.channel, (map.get(o.channel) || 0) + Number(o.total || 0)));
    return Array.from(map.entries()).map(([k, v]) => ({ name: k === "online" ? "أونلاين" : "محل", value: Math.round(v) }));
  }, [orders]);

  // Customer analytics
  const customerStats = useMemo(() => {
    const map = new Map<string, { id: string; orders: number; spent: number; lastAt: string }>();
    orders.forEach((o) => {
      const cur = map.get(o.customerId) || { id: o.customerId, orders: 0, spent: 0, lastAt: o.createdAt };
      cur.orders += 1; cur.spent += Number(o.total || 0);
      if (o.createdAt > cur.lastAt) cur.lastAt = o.createdAt;
      map.set(o.customerId, cur);
    });
    const arr = Array.from(map.values());
    const topSpenders = arr.sort((a, b) => b.spent - a.spent).slice(0, 20);
    const dist = { one: 0, mid: 0, loyal: 0 };
    arr.forEach((c) => { if (c.orders === 1) dist.one++; else if (c.orders <= 5) dist.mid++; else dist.loyal++; });
    const avgSpend = arr.length ? arr.reduce((a, c) => a + c.spent, 0) / arr.length : 0;
    return { total: arr.length, topSpenders, dist, avgSpend };
  }, [orders]);

  // By city
  const byCity = useMemo(() => {
    const sm = new Map(stores.map((s) => [s.id, s]));
    const map = new Map<string, { city: string; sales: number; orders: number }>();
    orders.forEach((o) => {
      const s = sm.get(o.storeId);
      const city = s?.area || "—";
      const cur = map.get(city) || { city, sales: 0, orders: 0 };
      cur.sales += Number(o.total || 0); cur.orders += 1;
      map.set(city, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [orders, stores]);

  // Hour×Day heatmap (matrix)
  const heatmap = useMemo(() => {
    const m: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      m[d.getDay()][d.getHours()] += 1;
    });
    return m;
  }, [orders]);

  // Store performance with rates
  const storePerf = useMemo(() => {
    return byStore.map((s) => {
      const ord = orders.filter((o) => o.storeId === s.storeId);
      const total = ord.length;
      const can = ord.filter((o) => o.status === "cancelled").length;
      const ret = ord.filter((o) => o.returnStatus && o.returnStatus !== "none").length;
      return { ...s, cancelRate: total ? (can / total) * 100 : 0, returnRate: total ? (ret / total) * 100 : 0 };
    });
  }, [byStore, orders]);

  const subtitle = `${range.from} → ${range.to}${range.storeId ? " • متجر محدد" : ""}${range.city ? ` • ${range.city}` : ""}`;

  const onExportExcel = () => {
    exportExcel(`baqalati-report-${range.from}_${range.to}`, [
      { name: "ملخص", rows: [{
        "من": range.from, "إلى": range.to,
        "إجمالي المبيعات": totalSales, "عدد الطلبات": orders.length,
        "متوسط الطلب": Math.round(avgOrder),
        "إجمالي العمولات": totalCommission, "صافي للتجار": netToMerchants,
        "ملغية": cancelled, "مكتملة": delivered, "مرتجعات": returnsCount,
      }] },
      { name: "يومي", rows: daily.map((d) => ({ التاريخ: d.day, المبيعات: Math.round(d.sales), الطلبات: d.orders, العمولة: Math.round(d.commission) })) },
      { name: "حسب المتجر", rows: storePerf.map((s) => ({ المتجر: s.name, المبيعات: Math.round(s.sales), الطلبات: s.orders, العمولة: Math.round(s.commission), "إلغاء%": s.cancelRate.toFixed(1), "إرجاع%": s.returnRate.toFixed(1) })) },
      { name: "حسب المدينة", rows: byCity.map((c) => ({ المدينة: c.city, المبيعات: Math.round(c.sales), الطلبات: c.orders })) },
      { name: "أعلى العملاء", rows: customerStats.topSpenders.map((c) => ({ الاسم: profiles[c.id]?.name || "—", الجوال: profiles[c.id]?.phone || "—", "عدد الطلبات": c.orders, "إجمالي الإنفاق": Math.round(c.spent) })) },
      { name: "Top منتجات", rows: productAgg.slice(0, 50).map((p) => ({ المنتج: p.name, الكمية: p.qty, الإيراد: Math.round(p.revenue) })) },
      { name: "بطيئة الحركة", rows: slowProducts.map((p) => ({ المنتج: p.name, السعر: p.price, المخزون: p.stock })) },
      { name: "نفد المخزون", rows: stockOut.map((p) => ({ المنتج: p.name, السعر: p.price })) },
      { name: "أسباب الإرجاع", rows: returnReasons.map((r) => ({ السبب: r.reason, العدد: r.count })) },
    ]);
  };

  const onExportPdf = () => {
    exportPdfPrint({
      title: "تقرير وصل",
      subtitle,
      sections: [
        { heading: "ملخص KPIs", columns: ["البند", "القيمة"], rows: [
          ["إجمالي المبيعات", money(totalSales)],
          ["عدد الطلبات", fmt(orders.length)],
          ["متوسط قيمة الطلب", money(avgOrder)],
          ["إجمالي العمولات", money(totalCommission)],
          ["صافي مستحق للتجار", money(netToMerchants)],
          ["طلبات ملغية", fmt(cancelled)],
          ["طلبات مكتملة", fmt(delivered)],
          ["مرتجعات", fmt(returnsCount)],
          ["عملاء نشطون", fmt(customerStats.total)],
        ] },
        { heading: "أداء المتاجر (Top 15)", columns: ["المتجر", "المبيعات", "الطلبات", "العمولة", "إلغاء%", "إرجاع%"],
          rows: storePerf.slice(0, 15).map((s) => [s.name, money(s.sales), s.orders, money(s.commission), s.cancelRate.toFixed(1), s.returnRate.toFixed(1)]) },
        { heading: "حسب المدينة", columns: ["المدينة", "المبيعات", "الطلبات"],
          rows: byCity.map((c) => [c.city, money(c.sales), c.orders]) },
        { heading: "أعلى 20 عميلاً", columns: ["العميل", "الجوال", "الطلبات", "الإنفاق"],
          rows: customerStats.topSpenders.map((c) => [profiles[c.id]?.name || "—", profiles[c.id]?.phone || "—", c.orders, money(c.spent)]) },
        { heading: "Top 20 منتج", columns: ["المنتج", "الكمية", "الإيراد"],
          rows: productAgg.slice(0, 20).map((p) => [p.name, p.qty, money(p.revenue)]) },
        { heading: "أسباب الإرجاع", columns: ["السبب", "العدد"],
          rows: returnReasons.map((r) => [r.reason, r.count]) },
      ],
    });
  };

  return (
    <AdminShell title="مركز التحليلات والتقارير">
      <ReportFilters
        value={range} onChange={setRange}
        onExportExcel={onExportExcel} onExportPdf={onExportPdf} onRefresh={load}
      />

      {loading ? (
        <div className="text-center p-8 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <Tabs defaultValue="sales" className="space-y-3">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="sales">المبيعات</TabsTrigger>
            <TabsTrigger value="customers">العملاء</TabsTrigger>
            <TabsTrigger value="merchants">التجار والمنتجات</TabsTrigger>
            <TabsTrigger value="geo">جغرافي وتشغيلي</TabsTrigger>
          </TabsList>

          {/* SALES */}
          <TabsContent value="sales" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiCard icon={BadgeDollarSign} label="إجمالي المبيعات" value={money(totalSales)} color="bg-teal-100 text-teal-700" />
              <KpiCard icon={ShoppingBag} label="عدد الطلبات" value={fmt(orders.length)} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={TrendingUp} label="متوسط الطلب" value={money(avgOrder)} color="bg-blue-100 text-blue-700" />
              <KpiCard icon={BadgeDollarSign} label="إجمالي العمولات" value={money(totalCommission)} color="bg-orange-100 text-orange-700" />
              <KpiCard icon={BadgeDollarSign} label="صافي للتجار" value={money(netToMerchants)} color="bg-emerald-100 text-emerald-700" />
              <KpiCard icon={Undo2} label="مرتجعات" value={fmt(returnsCount)} color="bg-red-100 text-red-700" />
              <KpiCard icon={ShoppingBag} label="ملغية" value={fmt(cancelled)} color="bg-amber-100 text-amber-700" />
              <KpiCard icon={ShoppingBag} label="مكتملة" value={fmt(delivered)} color="bg-green-100 text-green-700" />
            </div>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">المبيعات اليومية</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#0d9488" name="مبيعات" />
                  <Line type="monotone" dataKey="commission" stroke="#f59e0b" name="عمولة" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-sm font-bold mb-2">حسب طريقة الدفع</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byPayment} dataKey="value" nameKey="name" outerRadius={80} label>
                      {byPayment.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
              <Card className="p-3">
                <p className="text-sm font-bold mb-2">حسب القناة</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byChannel} dataKey="value" nameKey="name" outerRadius={80} label>
                      {byChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">أعلى 10 متاجر مبيعاً</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byStore.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} />
                  <YAxis dataKey="name" type="category" width={110} fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#0d9488" name="مبيعات" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          {/* CUSTOMERS */}
          <TabsContent value="customers" className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiCard icon={Users} label="عملاء نشطون" value={fmt(customerStats.total)} color="bg-blue-100 text-blue-700" />
              <KpiCard icon={BadgeDollarSign} label="متوسط الإنفاق" value={money(customerStats.avgSpend)} color="bg-emerald-100 text-emerald-700" />
              <KpiCard icon={Repeat} label="عملاء مكرّرون (+1)" value={fmt(customerStats.dist.mid + customerStats.dist.loyal)} color="bg-violet-100 text-violet-700" />
              <KpiCard icon={Repeat} label="عملاء أوفياء (+5)" value={fmt(customerStats.dist.loyal)} color="bg-orange-100 text-orange-700" />
            </div>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">توزيع التكرار</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { name: "طلب واحد", v: customerStats.dist.one },
                  { name: "2-5 طلبات", v: customerStats.dist.mid },
                  { name: "+6 طلبات", v: customerStats.dist.loyal },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#0d9488" name="عملاء" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">Top 20 عميل إنفاقاً</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr>
                    <th className="p-2 text-right">#</th><th className="p-2 text-right">العميل</th>
                    <th className="p-2 text-right">الجوال</th><th className="p-2 text-right">طلبات</th>
                    <th className="p-2 text-right">الإنفاق</th>
                  </tr></thead>
                  <tbody>
                    {customerStats.topSpenders.map((c, i) => (
                      <tr key={c.id} className="border-b">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">{profiles[c.id]?.name || "—"}</td>
                        <td className="p-2 ltr text-left">{profiles[c.id]?.phone || "—"}</td>
                        <td className="p-2">{c.orders}</td>
                        <td className="p-2 font-bold">{money(c.spent)}</td>
                      </tr>
                    ))}
                    {!customerStats.topSpenders.length && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">لا بيانات</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* MERCHANTS & PRODUCTS */}
          <TabsContent value="merchants" className="space-y-3">
            <Card className="p-3">
              <p className="text-sm font-bold mb-2">أداء المتاجر</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted"><tr>
                    <th className="p-2 text-right">المتجر</th>
                    <th className="p-2">طلبات</th><th className="p-2">مبيعات</th>
                    <th className="p-2">عمولة</th><th className="p-2">إلغاء%</th><th className="p-2">إرجاع%</th>
                  </tr></thead>
                  <tbody>
                    {storePerf.map((s) => (
                      <tr key={s.storeId} className="border-b">
                        <td className="p-2">{s.name}</td>
                        <td className="p-2 text-center">{s.orders}</td>
                        <td className="p-2 text-center font-bold">{money(s.sales)}</td>
                        <td className="p-2 text-center">{money(s.commission)}</td>
                        <td className="p-2 text-center">
                          <Badge variant={s.cancelRate > 20 ? "destructive" : "outline"}>{s.cancelRate.toFixed(1)}%</Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={s.returnRate > 10 ? "destructive" : "outline"}>{s.returnRate.toFixed(1)}%</Badge>
                        </td>
                      </tr>
                    ))}
                    {!storePerf.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">لا بيانات</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-sm font-bold mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Top 15 منتج</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr><th className="p-2 text-right">المنتج</th><th className="p-2">كمية</th><th className="p-2">إيراد</th></tr></thead>
                    <tbody>
                      {productAgg.slice(0, 15).map((p, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{p.name}</td><td className="p-2 text-center">{p.qty}</td>
                          <td className="p-2 text-center">{money(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card className="p-3">
                <p className="text-sm font-bold mb-2 flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4" /> نفد المخزون</p>
                <div className="max-h-64 overflow-y-auto text-xs space-y-1">
                  {stockOut.map((p) => (
                    <div key={p.id} className="flex justify-between border-b py-1"><span>{p.name}</span><span className="text-muted-foreground">{money(p.price)}</span></div>
                  ))}
                  {!stockOut.length && <p className="text-muted-foreground text-center p-2">لا منتجات نافدة</p>}
                </div>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-sm font-bold mb-2">منتجات بطيئة الحركة</p>
                <div className="max-h-64 overflow-y-auto text-xs space-y-1">
                  {slowProducts.map((p) => (
                    <div key={p.id} className="flex justify-between border-b py-1"><span>{p.name}</span><span className="text-muted-foreground">مخزون: {p.stock}</span></div>
                  ))}
                  {!slowProducts.length && <p className="text-muted-foreground text-center p-2">—</p>}
                </div>
              </Card>
              <Card className="p-3">
                <p className="text-sm font-bold mb-2 flex items-center gap-2"><Undo2 className="w-4 h-4" /> أسباب الإرجاع</p>
                <div className="text-xs space-y-1">
                  {returnReasons.map((r) => (
                    <div key={r.reason} className="flex justify-between border-b py-1"><span>{r.reason}</span><Badge variant="outline">{r.count}</Badge></div>
                  ))}
                  {!returnReasons.length && <p className="text-muted-foreground text-center p-2">لا مرتجعات</p>}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* GEO & OPS */}
          <TabsContent value="geo" className="space-y-3">
            <Card className="p-3">
              <p className="text-sm font-bold mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" /> خريطة اليمن — المتاجر وكثافة الطلبات</p>
              <AdminYemenMap
                stores={stores.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, status: s.status }))}
                orders={orders.map((o) => ({ lat: o.locationLat, lng: o.locationLng }))}
              />
              <div className="flex gap-4 text-xs mt-2 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500" /> متجر مفعّل</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500" /> بانتظار الموافقة</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500" /> موقوف</span>
              </div>
            </Card>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">المبيعات حسب المدينة</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byCity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="city" fontSize={11} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#3b82f6" name="مبيعات" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-3">
              <p className="text-sm font-bold mb-2">ذرى الطلبات (يوم × ساعة)</p>
              <div className="overflow-x-auto">
                <table className="text-[10px] border-collapse">
                  <thead><tr>
                    <th className="p-1"></th>
                    {Array.from({ length: 24 }, (_, h) => <th key={h} className="p-1 w-7">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"].map((day, di) => {
                      const max = Math.max(...heatmap.flat(), 1);
                      return (
                        <tr key={di}>
                          <td className="p-1 font-bold">{day}</td>
                          {heatmap[di].map((v, hi) => {
                            const intensity = v / max;
                            const bg = v === 0 ? "#f3f4f6" : `rgba(13,148,136,${0.15 + intensity * 0.85})`;
                            return <td key={hi} className="w-7 h-7 text-center" style={{ background: bg, color: intensity > 0.5 ? "#fff" : "#333" }} title={`${v}`}>{v || ""}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </AdminShell>
  );
}
