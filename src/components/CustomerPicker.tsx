import { useState } from "react";
import { http, errorMessage } from "@/api/client";
import { putCustomers } from "@/lib/offline-db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";


export type PickedCustomer = {
  kind: "registered" | "pending";
  id: string;
  name: string;
  phone: string;
};

type SearchRow = { id: string; name: string | null; phone: string | null; kind?: "registered" | "pending" };
type PendingRow = { id: string; storeId: string; name: string; phone: string; createdBy: string; claimedByUserId: string | null; createdAt: string };

function normalizeYemenPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("967")) return "+" + digits;
  if (digits.startsWith("7") && digits.length === 9) return "+967" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+967" + digits.slice(1);
  return null;
}

export function CustomerPicker({
  storeId,
  value,
  onChange,
  offlineFallback,
}: {
  storeId: string;
  value: PickedCustomer | null;
  onChange: (c: PickedCustomer | null) => void;
  offlineFallback?: { id: string; name: string; phone: string; kind: "registered" | "pending" }[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const searchLocal = (text: string): SearchRow[] => {
    const list = offlineFallback ?? [];
    const t = text.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return list
      .filter((c) =>
        (c.name && c.name.toLowerCase().includes(t)) ||
        (digits.length >= 3 && (c.phone || "").replace(/\D/g, "").includes(digits))
      )
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: c.name, phone: c.phone, kind: c.kind }));
  };

  const doSearch = async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) { setResults([]); return; }
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (!online) {
      setResults(searchLocal(text));
      return;
    }
    setSearching(true);
    try {
      // Registered customers already linked to this store + the store's own pending customers (was rpc search_customers_by_name).
      const rows = await http.get<SearchRow[]>("/merchant/customers/search", { q: text.trim() });
      setResults(rows.map((r) => ({ ...r, kind: r.kind ?? "registered" })));
      try {
        await putCustomers(
          rows
            .filter((r) => r.id)
            .map((r) => ({
              id: r.id,
              store_id: storeId,
              kind: r.kind ?? "registered",
              name: r.name ?? "",
              phone: r.phone ?? "",
            }))
        );
      } catch {}
    } catch {
      setResults(searchLocal(text));
    } finally {
      setSearching(false);
    }
  };

  const createPending = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("إضافة عميل جديد تتطلب اتصالاً بالإنترنت");
      return;
    }
    if (!newName.trim()) { toast.error("اكتب اسم العميل"); return; }
    const phone = normalizeYemenPhone(newPhone);
    if (!phone) { toast.error("رقم جوال غير صحيح"); return; }
    let data: PendingRow;
    try {
      data = await http.post<PendingRow>("/merchant/pending-customers", { name: newName.trim(), phone });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    try {
      await putCustomers([{ id: data.id, store_id: storeId, kind: "pending", name: data.name, phone: data.phone }]);
    } catch {}
    onChange({ kind: "pending", id: data.id, name: data.name, phone: data.phone });
    setOpenNew(false); setNewName(""); setNewPhone("");
  };


  if (value) {
    return (
      <div className="flex items-center justify-between bg-accent/50 rounded p-2">
        <div>
          <p className="font-medium text-sm">{value.name} {value.kind === "pending" && <span className="text-[10px] text-amber-600">(غير مسجل)</span>}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">{value.phone}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={() => onChange(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>العميل</Label>
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pr-9" placeholder="ابحث بالاسم أو الجوال..." value={q} onChange={(e) => doSearch(e.target.value)} />
      </div>
      {searching && <p className="text-xs text-muted-foreground">جاري البحث...</p>}
      {results.length > 0 && (
        <div className="border rounded divide-y max-h-48 overflow-y-auto">
          {results.map((r) => {
            const kind = r.kind ?? "registered";
            const picked: PickedCustomer = { kind, id: r.id, name: r.name || "—", phone: r.phone || "" };
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onChange(picked);
                  try { void putCustomers([{ id: picked.id, store_id: storeId, kind, name: picked.name, phone: picked.phone }]); } catch {}
                }}
                className="w-full text-right p-2 hover:bg-accent flex justify-between items-center"
              >
                <span className="text-sm">
                  {r.name || "—"}
                  {kind === "pending" && <span className="text-[10px] text-amber-600 mr-1">(غير مسجل)</span>}
                </span>
                <span className="text-xs text-muted-foreground" dir="ltr">{r.phone}</span>
              </button>
            );
          })}

        </div>
      )}
      <Button type="button" variant="outline" className="w-full" onClick={() => setOpenNew(true)}>
        <UserPlus className="w-4 h-4 ml-1" /> عميل جديد غير مسجل
      </Button>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>إضافة عميل جديد</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            عند تسجيل العميل لاحقاً في التطبيق بنفس الرقم سترتبط مديونياته تلقائياً.
          </p>
          <Input placeholder="اسم العميل" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input dir="ltr" inputMode="tel" placeholder="7XXXXXXXX" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <Button onClick={createPending}>حفظ</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
