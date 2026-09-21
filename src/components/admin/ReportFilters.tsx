import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { http } from "@/api/client";
import type { AdminStore } from "@/api/admin";

export type ReportRange = {
  from: string; // ISO date
  to: string; // ISO date
  storeId: string; // "" = all
  city: string; // "" = all
  channel: string; // "all" | "online" | "in_store"
  payment: string; // "all" | "cash" | ...
};

const presets: { label: string; days: number }[] = [
  { label: "اليوم", days: 0 },
  { label: "7 أيام", days: 7 },
  { label: "30 يوم", days: 30 },
  { label: "90 يوم", days: 90 },
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function defaultRange(): ReportRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: isoDay(from),
    to: isoDay(to),
    storeId: "",
    city: "",
    channel: "all",
    payment: "all",
  };
}

export function ReportFilters({
  value,
  onChange,
  onExportExcel,
  onExportPdf,
  onRefresh,
}: {
  value: ReportRange;
  onChange: (v: ReportRange) => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onRefresh?: () => void;
}) {
  const [stores, setStores] = useState<{ id: string; name: string; area: string | null }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const rows = await http.get<{ s: AdminStore }[]>("/admin/stores");
        setStores(rows.map(({ s }) => ({ id: s.id, name: s.name, area: s.area })).sort((a, b) => a.name.localeCompare(b.name, "ar")));
      } catch {
        setStores([]);
      }
    })();
  }, []);
  const cities = Array.from(new Set(stores.map((s) => s.area).filter(Boolean))) as string[];

  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ ...value, from: isoDay(from), to: isoDay(to) });
  };

  return (
    <Card className="p-3 mb-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button key={p.label} size="sm" variant="outline" onClick={() => setPreset(p.days)}>
            {p.label}
          </Button>
        ))}
        {onRefresh && (
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
        <div className="flex-1" />
        {onExportExcel && (
          <Button size="sm" variant="outline" onClick={onExportExcel}>
            <FileSpreadsheet className="w-4 h-4 ml-1" /> Excel
          </Button>
        )}
        {onExportPdf && (
          <Button size="sm" variant="outline" onClick={onExportPdf}>
            <FileText className="w-4 h-4 ml-1" /> PDF
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div>
          <Label className="text-[11px]">من</Label>
          <Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </div>
        <div>
          <Label className="text-[11px]">إلى</Label>
          <Input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
        <div>
          <Label className="text-[11px]">المتجر</Label>
          <select
            className="w-full h-10 border rounded-md px-2 text-sm bg-background"
            value={value.storeId}
            onChange={(e) => onChange({ ...value, storeId: e.target.value })}
          >
            <option value="">الكل</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[11px]">المدينة</Label>
          <select
            className="w-full h-10 border rounded-md px-2 text-sm bg-background"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          >
            <option value="">الكل</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[11px]">القناة</Label>
          <select
            className="w-full h-10 border rounded-md px-2 text-sm bg-background"
            value={value.channel}
            onChange={(e) => onChange({ ...value, channel: e.target.value })}
          >
            <option value="all">الكل</option>
            <option value="online">أونلاين</option>
            <option value="in_store">في المحل</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px]">الدفع</Label>
          <select
            className="w-full h-10 border rounded-md px-2 text-sm bg-background"
            value={value.payment}
            onChange={(e) => onChange({ ...value, payment: e.target.value })}
          >
            <option value="all">الكل</option>
            <option value="cash">نقدي</option>
            <option value="credit">آجل</option>
            <option value="wallet">محفظة</option>
            <option value="ewallet">محفظة إلكترونية</option>
          </select>
        </div>
      </div>
    </Card>
  );
}
