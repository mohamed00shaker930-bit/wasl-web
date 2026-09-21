import { fetchMyStore } from "@/lib/my-store";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import type { CategoryRow, OfferRow, ProductRow, StoreRow } from "@/api/merchant";
import { MerchantShell } from "@/components/MerchantShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fmtRial } from "@/lib/format";
import { Plus, Trash2, Camera, Link2, X, ScanBarcode, LibraryBig, Pencil, Tag } from "lucide-react";
import { CatalogPicker } from "@/components/CatalogPicker";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useRef, useState } from "react";

import { toast } from "sonner";

export const Route = createFileRoute("/merchant/products")({
  component: MerchantProducts,
});

const EMPTY_FORM = { name: "", price: "", image_url: "", category_id: "", barcode: "" };

function MerchantProducts() {
  const qc = useQueryClient();
  const { data: store } = useQuery({
    queryKey: ["my-store"],
    queryFn: async () => (await fetchMyStore()) as StoreRow | null,
  });
  const { data: cats } = useQuery({
    queryKey: ["my-cats"],
    queryFn: () => http.get<CategoryRow[]>("/merchant/categories"),
  });
  const { data: products } = useQuery({
    queryKey: ["my-products"],
    queryFn: () => http.get<ProductRow[]>("/merchant/products"),
  });
  const { data: offers } = useQuery({
    queryKey: ["my-offers"],
    queryFn: async () => (await http.get<OfferRow[]>("/merchant/offers")).filter((o) => o.active),
  });

  const [openCat, setOpenCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [openProd, setOpenProd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [p, setP] = useState(EMPTY_FORM);
  /** Picked/captured image, uploaded with POST /merchant/products/:id/image after the row is saved (no more base64 in image_url). */
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imgMode, setImgMode] = useState<"url" | "camera">("url");
  const [scanOpen, setScanOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offerFor, setOfferFor] = useState<ProductRow | null>(null);
  const [offerForm, setOfferForm] = useState({ discount_price: "", ends_at: "", max_qty: "" });

  const refreshAll = () => { qc.invalidateQueries({ queryKey: ["my-products"] }); qc.invalidateQueries({ queryKey: ["my-cats"] }); qc.invalidateQueries({ queryKey: ["my-offers"] }); qc.invalidateQueries({ queryKey: ["pos-products"] }); };

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("الصورة كبيرة جداً (الحد 2 ميجا)"); return; }
    // Downscale via canvas to keep the upload small; the data URL is only used for the preview.
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const max = 600;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { toast.error("تعذّر معالجة الصورة"); return; }
          setImageBlob(blob);
          setP((prev) => ({ ...prev, image_url: canvas.toDataURL("image/jpeg", 0.78) }));
        }, "image/jpeg", 0.78);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const addCat = async () => {
    if (!catName.trim()) { toast.error("اكتب اسم الفئة"); return; }
    if (!store) { toast.error("لا يوجد متجر. أنشئ متجراً أولاً"); return; }
    try {
      await http.post("/merchant/categories", { name: catName.trim(), sort_order: cats?.length ?? 0 });
      toast.success("أُضيفت الفئة"); setCatName(""); setOpenCat(false); refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const openAdd = () => { setEditingId(null); setP(EMPTY_FORM); setImageBlob(null); setOpenProd(true); };
  const openEdit = (pr: ProductRow) => {
    setEditingId(pr.id);
    setP({ name: pr.name, price: String(pr.price), image_url: pr.imageUrl ?? "", category_id: pr.categoryId ?? "", barcode: pr.barcode ?? "" });
    setImageBlob(null);
    setOpenProd(true);
  };

  const addProd = async () => {
    if (!p.name.trim()) { toast.error("اكتب اسم المنتج"); return; }
    if (!p.price) { toast.error("اكتب السعر"); return; }
    if (!store) { toast.error("لا يوجد متجر. أنشئ متجراً أولاً"); return; }
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: p.name.trim(), price: Number(p.price),
        category_id: p.category_id || null,
        barcode: p.barcode.trim() || null,
      };
      // A pasted URL goes in the body; a captured image is uploaded separately. Never send data: URLs.
      if (!imageBlob) payload.image_url = p.image_url && !p.image_url.startsWith("data:") ? p.image_url : null;
      let id = editingId;
      if (editingId) {
        await http.patch(`/merchant/products/${editingId}`, payload);
      } else {
        const created = await http.post<ProductRow | null>("/merchant/products", payload);
        if (!created) { toast.error("الباركود مستخدم مسبقاً لمنتج آخر"); return; }
        id = created.id;
      }
      if (imageBlob && id) await http.upload(`/merchant/products/${id}/image`, imageBlob, "product.jpg");
      toast.success(editingId ? "تم التحديث" : "أُضيف المنتج");
      setP(EMPTY_FORM); setImageBlob(null); setEditingId(null); setOpenProd(false); refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleStock = async (id: string, in_stock: boolean) => {
    try { await http.patch(`/merchant/products/${id}`, { in_stock }); refreshAll(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const removeProd = async (id: string) => {
    try { await http.del(`/merchant/products/${id}`); toast.success("تم الحذف"); refreshAll(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const deactivateOffers = async (productId: string) => {
    // PATCH /merchant/offers/:id takes the full OfferDto, so echo product_id + discount_price.
    for (const o of (offers ?? []).filter((x) => x.productId === productId)) {
      await http.patch(`/merchant/offers/${o.id}`, { product_id: o.productId, discount_price: Number(o.discountPrice), active: false });
    }
  };

  const saveOffer = async () => {
    if (!offerFor || !store) return;
    if (!offerForm.discount_price) { toast.error("اكتب السعر المخفّض"); return; }
    try {
      await deactivateOffers(offerFor.id);
      await http.post("/merchant/offers", {
        product_id: offerFor.id,
        discount_price: Number(offerForm.discount_price),
        ends_at: offerForm.ends_at ? new Date(offerForm.ends_at).toISOString() : null,
        max_qty: offerForm.max_qty ? Number(offerForm.max_qty) : null,
        active: true,
      });
      toast.success("تم حفظ العرض"); setOfferFor(null); setOfferForm({ discount_price: "", ends_at: "", max_qty: "" }); refreshAll();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const cancelOffer = async (productId: string) => {
    try { await deactivateOffers(productId); toast.success("أُلغي العرض"); refreshAll(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const offerOf = (pid: string) => (offers ?? []).find((o) => o.productId === pid);

  return (
    <MerchantShell title="المنتجات" action={
      <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setCatalogOpen(true)}>
        <LibraryBig className="w-4 h-4 ml-1" />المكتبة
      </Button>
      <Dialog open={openProd} onOpenChange={(v) => { if (!v) setEditingId(null); setOpenProd(v); }}>
        <DialogTrigger asChild><Button size="sm" variant="secondary" onClick={openAdd}><Plus className="w-4 h-4 ml-1" />منتج</Button></DialogTrigger>

        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "تعديل منتج" : "منتج جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={p.name} onChange={(e) => setP({...p, name: e.target.value})} /></div>
            <div><Label>السعر (ر.ي)</Label><Input dir="ltr" value={p.price} onChange={(e) => setP({...p, price: e.target.value})} inputMode="numeric" /></div>
            <div className="space-y-2">
              <Label>صورة المنتج</Label>
              {p.image_url ? (
                <div className="relative w-28 h-28 rounded-lg overflow-hidden border">
                  <img src={p.image_url} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setP({...p, image_url: ""}); setImageBlob(null); }}
                    className="absolute top-1 left-1 bg-destructive text-destructive-foreground rounded-full p-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => cameraRef.current?.click()}>
                    <Camera className="w-4 h-4 ml-1" /> التقط صورة
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => galleryRef.current?.click()}>
                    من المعرض
                  </Button>
                  <Button type="button" size="sm" variant={imgMode==="url"?"default":"outline"} onClick={() => setImgMode("url")}>
                    <Link2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <input ref={galleryRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {!p.image_url && imgMode === "url" && (
                <Input dir="ltr" placeholder="https://..." value={p.image_url} onChange={(e) => { setImageBlob(null); setP({...p, image_url: e.target.value}); }} />
              )}
            </div>
            <div>
              <Label>الفئة</Label>
              <Select value={p.category_id} onValueChange={(v) => setP({...p, category_id: v})}>
                <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
                <SelectContent>{cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الباركود (اختياري)</Label>
              <div className="flex gap-2">
                <Input dir="ltr" value={p.barcode} onChange={(e) => setP({...p, barcode: e.target.value})} placeholder="6219..." />
                <Button type="button" variant="outline" size="icon" onClick={() => setScanOpen(true)}>
                  <ScanBarcode className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button onClick={addProd} className="w-full" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
          </div>
          <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(code) => { setP((prev) => ({...prev, barcode: code})); setScanOpen(false); }} title="مسح باركود المنتج" />
        </DialogContent>
      </Dialog>
      </div>
    }>
      <CatalogPicker open={catalogOpen} onClose={() => setCatalogOpen(false)} onImported={() => { setCatalogOpen(false); refreshAll(); }} />
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">الفئات</h3>
            <Dialog open={openCat} onOpenChange={setOpenCat}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4" /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>فئة جديدة</DialogTitle></DialogHeader>
                <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="مثل: مشروبات" />
                <Button onClick={addCat}>حفظ</Button>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-wrap gap-2">
            {cats?.length === 0 && <p className="text-xs text-muted-foreground">لا فئات بعد</p>}
            {cats?.map((c) => <span key={c.id} className="text-xs bg-accent px-2 py-1 rounded-full">{c.name}</span>)}
          </div>
        </Card>

        <div className="space-y-2">
          {products?.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا منتجات بعد. أضف منتجك الأول.</Card>}
          {products?.map((pr) => {
            const offer = offerOf(pr.id);
            return (
              <Card key={pr.id} className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xl shrink-0">
                  {pr.imageUrl ? <img src={pr.imageUrl} className="w-full h-full object-cover rounded" /> : "🛒"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{pr.name}</p>
                  {offer ? (
                    <p className="text-xs">
                      <span className="text-destructive font-bold">{fmtRial(offer.discountPrice)}</span>
                      <span className="text-muted-foreground line-through mr-1">{fmtRial(pr.price)}</span>
                      <span className="text-[10px] bg-destructive/10 text-destructive rounded px-1 mr-1">عرض</span>
                    </p>
                  ) : (
                    <p className="text-xs text-primary">{fmtRial(pr.price)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={pr.inStock} onCheckedChange={(v) => toggleStock(pr.id, v)} />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(pr)} title="تعديل"><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => offer ? cancelOffer(pr.id) : (setOfferFor(pr), setOfferForm({ discount_price: "", ends_at: "", max_qty: "" }))} title="عرض">
                    <Tag className={`w-4 h-4 ${offer ? "text-destructive" : ""}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeProd(pr.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={!!offerFor} onOpenChange={(v) => !v && setOfferFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>عرض على: {offerFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>السعر المخفّض (السعر الأصلي {fmtRial(offerFor?.price ?? 0)})</Label>
              <Input dir="ltr" inputMode="numeric" value={offerForm.discount_price} onChange={(e) => setOfferForm({...offerForm, discount_price: e.target.value})} />
            </div>
            <div>
              <Label>ينتهي في (اختياري)</Label>
              <Input type="datetime-local" value={offerForm.ends_at} onChange={(e) => setOfferForm({...offerForm, ends_at: e.target.value})} />
            </div>
            <div>
              <Label>الكمية القصوى للعرض (اختياري)</Label>
              <Input dir="ltr" inputMode="numeric" placeholder="مثلاً 50" value={offerForm.max_qty} onChange={(e) => setOfferForm({...offerForm, max_qty: e.target.value})} />
            </div>
            <Button onClick={saveOffer} className="w-full">حفظ العرض</Button>
          </div>
        </DialogContent>
      </Dialog>

    </MerchantShell>
  );
}
