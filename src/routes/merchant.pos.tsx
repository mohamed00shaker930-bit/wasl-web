import { fetchMyStore } from "@/lib/my-store";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/api/client";
import { useAuth } from "@/auth/store";
import type { PosSnapshot, StoreRow } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { fmtRial } from "@/lib/format";
import { formatDateTime } from "@/lib/dateFormat";
import { ScanBarcode, Plus, Minus, Trash2, Search, CheckCircle2, Wallet, Banknote, BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CustomerPicker, type PickedCustomer } from "@/components/CustomerPicker";
import { toast } from "sonner";
import {
  getProductsByStore,
  putProduct,
  putProducts,
  getCustomersByStore,
  putCustomers,
  type LocalCustomer,
  type LocalProduct,
} from "@/lib/offline-db";
import { enqueue, flush, bindQueryClient } from "@/lib/pos-outbox";
import { SyncStatusChip } from "@/components/SyncStatusChip";

export const Route = createFileRoute("/merchant/pos")({
  component: POS,
});

type Line = { product_id: string; name: string; price: number; qty: number };
type PayMethod = "cash" | "credit" | "jeeb" | "jawali" | "hasab" | "onecash";

const WALLETS: { id: PayMethod; name: string; short: string }[] = [
  { id: "jeeb", name: "جيب", short: "ج" },
  { id: "jawali", name: "جوالي", short: "ج" },
  { id: "hasab", name: "حاسب", short: "ح" },
  { id: "onecash", name: "ون كاش", short: "1" },
];

function newUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // fallback
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** API product row (camelCase, price as string) → IndexedDB shape the outbox and the old UI expect. */
function toLocalProduct(storeId: string, p: PosSnapshot["products"][number]): LocalProduct {
  return {
    id: p.id, store_id: storeId, name: p.name, price: Number(p.price),
    barcode: p.barcode ?? null, image_url: p.imageUrl ?? null, category_id: p.categoryId ?? null, in_stock: p.inStock,
  };
}

function POS() {
  const qc = useQueryClient();
  useEffect(() => { bindQueryClient(qc); }, [qc]);
  const { me } = useAuth();

  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await fetchMyStore()) as StoreRow | null,
  });

  // One snapshot call preloads products + credit/pending customers (was 3–4 queries and an RPC per customer).
  // Offline (or on any error) the IndexedDB copy is served instead.
  const { data: snapshot } = useQuery({
    queryKey: ["pos-products", store?.id],
    enabled: !!store?.id,
    placeholderData: { products: [] as LocalProduct[], customers: [] as LocalCustomer[] },
    queryFn: async () => {
      const sid = store!.id;
      const [localProducts, localCustomers] = await Promise.all([getProductsByStore(sid), getCustomersByStore(sid)]);
      try {
        const snap = await http.get<PosSnapshot>("/merchant/pos/snapshot");
        const products = (snap.products ?? []).map((p) => toLocalProduct(sid, p)).sort((a, b) => a.name.localeCompare(b.name, "ar"));
        const seen = new Set<string>();
        const customers: LocalCustomer[] = [];
        for (const c of snap.customers ?? []) {
          if (!c?.id || seen.has(c.id)) continue;
          seen.add(c.id);
          customers.push({ id: c.id, store_id: sid, kind: c.kind, name: c.name ?? "", phone: c.phone ?? "" });
        }
        if (products.length) { try { await putProducts(products); } catch { /* private mode */ } }
        if (customers.length) { try { await putCustomers(customers); } catch { /* private mode */ } }
        return { products: products.length ? products : localProducts, customers: customers.length ? customers : localCustomers };
      } catch {
        return { products: localProducts, customers: localCustomers };
      }
    },
  });
  const products = snapshot?.products ?? [];
  const offlineCustomers = snapshot?.customers ?? [];

  const [lines, setLines] = useState<Line[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<PayMethod>("cash");
  const [walletRef, setWalletRef] = useState("");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [newProd, setNewProd] = useState({ name: "", price: "" });
  const [receipt, setReceipt] = useState<{ id: string; lines: Line[]; total: number; payment: PayMethod } | null>(null);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);

  // flush on mount
  useEffect(() => {
    void flush();
  }, []);

  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.qty, 0), [lines]);
  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  const addProduct = (pr: { id: string; name: string; price: number }) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product_id === pr.id);
      if (i >= 0) {
        const copy = [...prev]; copy[i] = { ...copy[i], qty: copy[i].qty + 1 }; return copy;
      }
      return [...prev, { product_id: pr.id, name: pr.name, price: Number(pr.price), qty: 1 }];
    });
    try { navigator.vibrate?.(30); } catch {}
  };

  const onDetected = (code: string) => {
    const found = products.find((p) => p.barcode === code);
    if (found) {
      addProduct({ id: found.id, name: found.name, price: Number(found.price) });
      setScanOpen(false);
      toast.success(`أُضيف: ${found.name}`);
    } else {
      setScanOpen(false);
      setUnknownCode(code);
    }
  };

  const saveUnknown = async () => {
    if (!unknownCode || !store) return;
    if (!newProd.name.trim() || !newProd.price) { toast.error("اكتب الاسم والسعر"); return; }
    const id = newUuid();
    const row: LocalProduct = {
      id,
      store_id: store.id,
      name: newProd.name.trim(),
      price: Number(newProd.price),
      barcode: unknownCode,
    };
    await putProduct(row);
    await enqueue({
      id: newUuid(),
      kind: "new_product",
      createdAt: new Date().toISOString(),
      payload: row,
    });
    qc.invalidateQueries({ queryKey: ["pos-products"] });
    qc.invalidateQueries({ queryKey: ["my-products"] });
    addProduct({ id, name: row.name, price: row.price });
    setUnknownCode(null); setNewProd({ name: "", price: "" });
    toast.success("أُضيف المنتج وبيع");
    void flush();
  };

  const changeQty = (id: string, delta: number) => {
    setLines((prev) => prev.flatMap((l) => {
      if (l.product_id !== id) return [l];
      const q = l.qty + delta;
      return q <= 0 ? [] : [{ ...l, qty: q }];
    }));
  };
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.product_id !== id));

  const checkout = async () => {
    if (!store) { toast.error("لا يوجد متجر"); return; }
    if (lines.length === 0) { toast.error("الفاتورة فارغة"); return; }
    if (payment === "credit" && !customer) { toast.error("اختر العميل لبيع الأجل"); return; }
    setSaving(true);
    try {
      const uid = me?.user.id;
      if (!uid) { toast.error("غير مسجل"); return; }

      const isWallet = payment !== "cash" && payment !== "credit";
      const orderId = newUuid();
      const createdAt = new Date().toISOString();

      let note: string | null = null;
      let orderCustomerId = uid;
      let creditStatus: string | null = null;
      let orderStatus: string = "delivered";

      if (payment === "credit" && customer?.kind === "pending") {
        note = `أجل لعميل غير مسجل: ${customer.name} (${customer.phone}). سيتم تفعيله عند تسجيله.`;
        orderCustomerId = uid;
        creditStatus = "pending";
        orderStatus = "sent";
      } else if (payment === "credit" && customer?.kind === "registered") {
        orderCustomerId = customer.id;
        creditStatus = "pending";
        orderStatus = "sent";
      } else if (isWallet && walletRef) {
        note = `محفظة ${payment} - مرجع: ${walletRef}`;
      }

      // Same envelope as before: pos-outbox posts it verbatim to /merchant/pos/sales when online.
      const order = {
        id: orderId,
        store_id: store.id,
        customer_id: orderCustomerId,
        total,
        payment_method: payment,
        status: orderStatus,
        channel: "in_store",
        credit_status: creditStatus,
        note,
        created_at: createdAt,
      };
      const items = lines.map((l) => ({
        id: newUuid(),
        order_id: orderId,
        product_id: l.product_id,
        name: l.name,
        price: l.price,
        qty: l.qty,
      }));

      const credit =
        payment === "credit" && customer
          ? {
              customerKind: customer.kind,
              customerId: customer.id,
              txId: newUuid(),
              amount: total,
              note: customer.kind === "pending"
                ? "بيع داخل المحل - أجل (عميل غير مسجل)"
                : "بيع داخل المحل - أجل",
            }
          : undefined;

      await enqueue({
        id: newUuid(),
        kind: "sale",
        createdAt,
        payload: { order, items, credit },
      });

      setReceipt({ id: orderId, lines, total, payment });
      setLines([]); setWalletRef(""); setPayment("cash"); setCustomer(null);
      toast.success(
        payment === "credit" ? "سُجّل — سيُرسل للعميل عند المزامنة" : "تم إتمام البيع"
      );
      void flush();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MerchantShell title="نقطة البيع" action={<SyncStatusChip />}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" className="h-16 text-base" onClick={() => setScanOpen(true)}>
            <ScanBarcode className="w-6 h-6 ml-2" /> مسح باركود
          </Button>
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-16 pr-9" placeholder="ابحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length > 0 && (
          <Card className="p-2 space-y-1">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => { addProduct({ id: p.id, name: p.name, price: Number(p.price) }); setSearch(""); }}
                className="w-full flex justify-between items-center p-2 hover:bg-accent rounded text-right">
                <span>{p.name}</span>
                <span className="text-primary text-sm">{fmtRial(p.price)}</span>
              </button>
            ))}
          </Card>
        )}

        <Card className="p-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">الفاتورة الحالية</h3>
            {lines.length > 0 && <Button size="sm" variant="ghost" onClick={() => setLines([])}>تفريغ</Button>}
          </div>
          {lines.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">امسح باركود أو ابحث لإضافة منتج</p>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.product_id} className="flex items-center gap-2 border-b pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{l.name}</p>
                    <p className="text-xs text-primary">{fmtRial(l.price * l.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.product_id, -1)}><Minus className="w-3 h-3" /></Button>
                    <span className="w-6 text-center font-bold">{l.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.product_id, +1)}><Plus className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(l.product_id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {lines.length > 0 && (
          <Card className="p-3 space-y-3">
            <Label>طريقة الدفع</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={payment === "cash" ? "default" : "outline"} onClick={() => setPayment("cash")}>
                <Banknote className="w-4 h-4 ml-1" /> نقداً
              </Button>
              <Button variant={payment === "credit" ? "default" : "outline"} onClick={() => setPayment("credit")}>
                <BookOpen className="w-4 h-4 ml-1" /> آجل
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {WALLETS.map((w) => (
                <Button key={w.id} size="sm" variant={payment === w.id ? "default" : "outline"} onClick={() => setPayment(w.id)} className="flex-col h-14 text-[10px] gap-0">
                  <Wallet className="w-4 h-4" />
                  <span>{w.name}</span>
                </Button>
              ))}
            </div>
            {payment !== "cash" && payment !== "credit" && (
              <Input dir="ltr" placeholder="رقم مرجع المحفظة (اختياري)" value={walletRef} onChange={(e) => setWalletRef(e.target.value)} />
            )}
            {payment === "credit" && store && (
              <div className="border-t pt-3">
                <CustomerPicker
                  storeId={store.id}
                  value={customer}
                  onChange={setCustomer}
                  offlineFallback={offlineCustomers}
                />
                <p className="text-[11px] text-muted-foreground mt-2">سيُرسل للعميل إشعار لقبول الفاتورة قبل إضافتها لذمته.</p>
              </div>
            )}
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-sm text-muted-foreground">الإجمالي</span>
              <span className="text-2xl font-bold text-primary">{fmtRial(total)}</span>
            </div>
            <Button size="lg" className="w-full h-14 text-base" onClick={checkout} disabled={saving}>
              <CheckCircle2 className="w-5 h-5 ml-2" /> {saving ? "جارٍ الحفظ..." : "إتمام البيع"}
            </Button>
          </Card>
        )}
      </div>

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={onDetected} title="امسح المنتج" />

      <Dialog open={!!unknownCode} onOpenChange={(v) => !v && setUnknownCode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>منتج جديد</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground" dir="ltr">{unknownCode}</p>
          <Input placeholder="اسم المنتج" value={newProd.name} onChange={(e) => setNewProd({...newProd, name: e.target.value})} />
          <Input dir="ltr" inputMode="numeric" placeholder="السعر" value={newProd.price} onChange={(e) => setNewProd({...newProd, price: e.target.value})} />
          <Button onClick={saveUnknown}>حفظ وإضافة للفاتورة</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(v) => !v && setReceipt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إيصال البيع</DialogTitle></DialogHeader>
          {receipt && (
            <div className="space-y-2">
              <div className="text-center text-xs text-muted-foreground">
                <p className="font-bold text-base text-foreground">{store?.name}</p>
                <p>فاتورة #{receipt.id.slice(0, 8)}</p>
                <p>{formatDateTime(new Date())}</p>
              </div>
              <div className="border-t border-b py-2 space-y-1 text-sm">
                {receipt.lines.map((l) => (
                  <div key={l.product_id} className="flex justify-between">
                    <span>{l.name} × {l.qty}</span>
                    <span>{fmtRial(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>الإجمالي</span>
                <span className="text-primary">{fmtRial(receipt.total)}</span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                الدفع: {receipt.payment === "cash" ? "نقداً" : receipt.payment === "credit" ? "آجل" : `محفظة (${receipt.payment})`}
              </p>
              <Button className="w-full" onClick={() => setReceipt(null)}>تم</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MerchantShell>
  );
}
