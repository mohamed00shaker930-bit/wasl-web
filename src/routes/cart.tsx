import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cart, useCart } from "@/lib/cart";
import { fmtRial } from "@/lib/format";
import { Trash2, Plus, Minus, Banknote, Clock, Wallet, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { EXTERNAL_WALLETS as WALLETS, cartTotal, validateCheckout, type PayMethod } from "@/lib/checkout";
import { http, errorMessage } from "@/api/client";
import { requireAuth } from "@/auth/guards";

export const Route = createFileRoute("/cart")({
  beforeLoad: () => requireAuth(),
  component: CartPage,
});

function CartPage() {
  const c = useCart();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PayMethod>("cash");
  const [walletRef, setWalletRef] = useState("");
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const total = cartTotal(c.items);

  // ملاحظة: يجب أن تُستدعى جميع الـ hooks قبل أي return مبكر (قاعدة React الأساسية)
  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => http.get<{ balance: number }>("/me/wallet") });

  if (c.items.length === 0) {
    return (
      <CustomerShell title="السلة">
        <Card className="p-10 text-center text-muted-foreground">
          <p>سلتك فارغة</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/home" })}>تصفح البقالات</Button>
        </Card>
      </CustomerShell>
    );
  }

  const checkout = async () => {
    const v = validateCheckout({ storeId: c.storeId, items: c.items, landmark, payment, walletBalance: wallet?.balance ?? 0 });
    if (!v.ok) { toast.error(v.error); return; }
    setLoading(true);
    try {
      // one request: the API re-reads prices, writes order + items and debits the wallet in a single transaction
      await http.post("/orders", {
        store_id: c.storeId, items: c.items.map((i) => ({ product_id: i.productId, qty: i.qty, note: i.note || undefined })),
        payment_method: payment, location: { landmark, phone: phone || undefined }, note: note || undefined, wallet_ref: walletRef || undefined,
      });
      cart.clear();
      toast.success("تم إرسال الطلب");
      navigate({ to: "/orders" });
    } catch (e) { toast.error(errorMessage(e, "فشل إرسال الطلب")); }
    finally { setLoading(false); }
  };

  return (
    <CustomerShell title={`سلة ${c.storeName || ""}`}>
      <div className="space-y-3">
        {c.items.map((i) => (
          <Card key={i.productId} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{i.name}</p>
              <p className="text-xs text-muted-foreground">{fmtRial(i.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => cart.setQty(i.productId, i.qty - 1)}><Minus className="w-3 h-3" /></Button>
              <span className="w-6 text-center font-bold">{i.qty}</span>
              <Button size="sm" className="h-7 w-7 p-0" onClick={() => cart.setQty(i.productId, i.qty + 1)}><Plus className="w-3 h-3" /></Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => cart.remove(i.productId)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </Card>
        ))}

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">موقع التوصيل</h3>
            <Link to="/locations" className="text-xs text-primary">إدارة المواقع</Link>
          </div>
          <SavedLocationsPicker onPick={(l) => {
            setLandmark(l.landmark_text || "");
            if (l.phone) setPhone(l.phone);
            toast.success(`تم استخدام موقع: ${l.label}`);
          }} />
          <div className="space-y-2">
            <Label>وصف الموقع / معلم قريب *</Label>
            <Textarea value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="مثال: بجانب الجامع الأزرق، البيت الثاني..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>رقم للتواصل</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="7XXXXXXXX" />
          </div>
        </Card>


        <Card className="p-4 space-y-3">
          <h3 className="font-bold">طريقة الدفع</h3>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setPayment("cash")}
              className={`flex items-center gap-1 p-3 rounded-xl border-2 transition ${payment==="cash"?"border-primary bg-primary/5":"border-border"}`}>
              <Banknote className="w-5 h-5 text-success" />
              <span className="text-xs font-medium">نقداً</span>
            </button>
            <button type="button" onClick={() => setPayment("credit")}
              className={`flex items-center gap-1 p-3 rounded-xl border-2 transition ${payment==="credit"?"border-primary bg-primary/5":"border-border"}`}>
              <Clock className="w-5 h-5 text-warning" />
              <span className="text-xs font-medium">بالأجل</span>
            </button>
            <button type="button" onClick={() => setPayment("wallet")}
              className={`flex flex-col items-start gap-0 p-3 rounded-xl border-2 transition text-right ${payment==="wallet"?"border-primary bg-primary/5":"border-border"}`}>
              <div className="flex items-center gap-1"><Wallet className="w-5 h-5 text-primary" /><span className="text-xs font-medium">المحفظة</span></div>
              <span className="text-[10px] text-muted-foreground">{fmtRial(Number(wallet?.balance ?? 0))}</span>
            </button>
          </div>
          {payment === "wallet" && Number(wallet?.balance ?? 0) < total && (
            <p className="text-[11px] text-destructive">الرصيد غير كافٍ — اشحن المحفظة أولاً.</p>
          )}


          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Wallet className="w-3 h-3" /> المحافظ الإلكترونية</p>
            <div className="grid grid-cols-4 gap-2">
              {WALLETS.map((w) => (
                <button key={w.id} type="button" onClick={() => setPayment(w.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition ${payment===w.id?"border-primary bg-primary/5":"border-border"}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow" style={{ background: w.color }}>{w.short}</div>
                  <span className="text-[11px] font-medium">{w.name}</span>
                </button>
              ))}
            </div>
          </div>

          {payment !== "cash" && payment !== "credit" && payment !== "wallet" && (
            <div className="space-y-1">
              <Label className="text-xs">رقم العملية / المرجع (بعد التحويل)</Label>
              <Input dir="ltr" value={walletRef} onChange={(e) => setWalletRef(e.target.value)} placeholder="مثال: TXN123456" />
              <p className="text-[11px] text-muted-foreground">حوّل المبلغ إلى رقم البقالة ثم أدخل رقم العملية ليتأكد البقال.</p>
            </div>
          )}
          {payment === "credit" && (
            <p className="text-[11px] text-muted-foreground">يحتاج موافقة البقالة — بدون فوائد.</p>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <Label>ملاحظة للبقال (اختياري)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Card>

        <Card className="p-4 sticky bottom-20 bg-card shadow-lg">
          <div className="flex justify-between mb-3">
            <span className="font-bold">الإجمالي</span>
            <span className="font-bold text-primary text-lg">{fmtRial(total)}</span>
          </div>
          <Button onClick={checkout} disabled={loading} className="w-full h-12 text-base">
            {loading ? "..." : "تأكيد الطلب"}
          </Button>
        </Card>
      </div>
    </CustomerShell>
  );
}

function SavedLocationsPicker({ onPick }: { onPick: (l: { label: string; landmark_text: string; phone: string | null }) => void }) {
  const { data: locs } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => (await http.get<any[]>("/me/locations")).map((l) => ({ ...l, landmark_text: l.landmarkText })),
  });
  if (!locs || locs.length === 0) return null;
  return (
    <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
      {locs.map((l: any) => (
        <button key={l.id} type="button" onClick={() => onPick(l)}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent/40 hover:bg-accent border text-xs">
          <MapPin className="w-3 h-3 text-primary" />
          <span className="font-medium">{l.label}</span>
        </button>
      ))}
    </div>
  );
}
