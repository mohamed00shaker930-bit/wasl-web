import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { http, errorMessage } from "@/api/client";
import { toast } from "sonner";
import { Users, Store, ShoppingBag, Wallet, Clock, Undo2, BadgeDollarSign, Bell } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Overview,
});

type Overview = {
  users: number; pending_accounts: number; merchants: number; stores_active: number; stores_pending: number;
  orders_today: number; sales_today: number; commission_today: number; pending_wallet_tx: number; returns_requested: number;
};

function Stat({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </Card>
  );
}

function Overview() {
  const [s, setS] = useState<Overview | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setS(await http.get<Overview>("/admin/overview"));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    })();
  }, []);
  if (!s) return <AdminShell title="نظرة عامة"><div className="text-center p-8 text-muted-foreground">جاري التحميل...</div></AdminShell>;
  return (
    <AdminShell title="نظرة عامة">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Users} label="المستخدمون" value={s.users} color="bg-blue-100 text-blue-700" />
        <Stat icon={Store} label="متاجر مفعّلة" value={s.stores_active} color="bg-emerald-100 text-emerald-700" />
        <Stat icon={Clock} label="متاجر بانتظار الموافقة" value={s.stores_pending} color="bg-amber-100 text-amber-700" />
        <Stat icon={ShoppingBag} label="طلبات اليوم" value={s.orders_today} color="bg-violet-100 text-violet-700" />
        <Stat icon={BadgeDollarSign} label="مبيعات اليوم" value={Number(s.sales_today || 0).toLocaleString() + " ر.ي"} color="bg-teal-100 text-teal-700" />
        <Stat icon={BadgeDollarSign} label="عمولات اليوم" value={Number(s.commission_today || 0).toLocaleString() + " ر.ي"} color="bg-orange-100 text-orange-700" />
        <Stat icon={Wallet} label="شحن محافظ معلّق" value={s.pending_wallet_tx} color="bg-pink-100 text-pink-700" />
        <Stat icon={Undo2} label="مرتجعات معلّقة" value={s.returns_requested} color="bg-red-100 text-red-700" />
      </div>
      <Card className="p-4 mt-4">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Bell className="w-4 h-4" /> الإجراءات السريعة متاحة من شريط التنقّل بالأسفل: اعتماد المتاجر، شحن المحافظ، إرسال إشعارات، تعديل الإعدادات.
        </p>
      </Card>
    </AdminShell>
  );
}
