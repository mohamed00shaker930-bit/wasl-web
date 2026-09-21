import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KeyRound } from "lucide-react";
import { http, errorMessage } from "@/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: Page });

const NUM_KEYS = ["default_commission_pct", "delivery_fee", "min_order", "max_credit"];
const BOOL_KEYS = ["wallets_enabled", "credit_enabled", "ewallets_enabled"];
const STR_KEYS = ["support_phone"];

const LABELS: Record<string, string> = {
  default_commission_pct: "نسبة العمولة الافتراضية (%)",
  delivery_fee: "رسوم التوصيل الافتراضية (ر.ي)",
  min_order: "الحد الأدنى للطلب (ر.ي)",
  max_credit: "الحد الأقصى للأجل (ر.ي)",
  wallets_enabled: "تفعيل المحفظة",
  credit_enabled: "تفعيل الدفع الآجل",
  ewallets_enabled: "تفعيل المحافظ الإلكترونية",
  support_phone: "رقم دعم واتساب",
};

type Setting = { key: string; value: unknown; updatedAt: string };

function Page() {
  const [vals, setVals] = useState<Record<string, any>>({});
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const data = await http.get<Setting[]>("/admin/settings");
      const m: Record<string, any> = {};
      data.forEach((r) => { m[r.key] = r.value; });
      setVals(m);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const save = async (key: string, value: any) => {
    try {
      await http.put(`/admin/settings/${key}`, { value });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("تم الحفظ");
    setVals((v) => ({ ...v, [key]: value }));
  };

  return (
    <AdminShell title="إعدادات النظام">
      <div className="space-y-3">
        {/* inputs are uncontrolled (defaultValue), so they mount only once the values are in */}
        {!loaded ? <p className="text-center text-muted-foreground py-8">جاري التحميل...</p> : (
          <>
            {NUM_KEYS.map((k) => (
              <Card key={k} className="p-3 flex items-center gap-3">
                <Label className="flex-1">{LABELS[k]}</Label>
                <Input type="number" step="0.01" className="w-32" defaultValue={vals[k] ?? 0} onBlur={(e) => save(k, Number(e.target.value))} />
              </Card>
            ))}
            {STR_KEYS.map((k) => (
              <Card key={k} className="p-3 flex items-center gap-3">
                <Label className="flex-1">{LABELS[k]}</Label>
                <Input className="w-48" defaultValue={vals[k] ?? ""} onBlur={(e) => save(k, e.target.value)} />
              </Card>
            ))}
            {BOOL_KEYS.map((k) => (
              <Card key={k} className="p-3 flex items-center gap-3">
                <Label className="flex-1">{LABELS[k]}</Label>
                <Switch checked={!!vals[k]} onCheckedChange={(v) => save(k, v)} />
              </Card>
            ))}
          </>
        )}

        <Card className="p-4">
          <h3 className="font-bold flex items-center gap-2 mb-3"><KeyRound className="w-4 h-4 text-primary" /> الحساب</h3>
          <Button asChild variant="outline" className="w-full">
            <Link to="/change-password">تغيير كلمة المرور</Link>
          </Button>
        </Card>
      </div>
    </AdminShell>
  );
}
