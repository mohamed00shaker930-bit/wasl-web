import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/api/client";
import { snake } from "@/api/shape";
import { requireAuth } from "@/auth/guards";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useEffect } from "react";
import { cart, useCart } from "@/lib/cart";
import { fmtRial } from "@/lib/format";
import { Plus, Minus, ShoppingCart, Search, MessageSquarePlus, Package, ArrowRight } from "lucide-react";
import { CustomRequestDialog } from "@/components/CustomRequestDialog";
import { FavoriteButton } from "@/components/FavoriteButton";
import { BarcodeSearchButton } from "@/components/BarcodeSearchButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FALLBACK_SECTION = "أخرى";

export const Route = createFileRoute("/store/$storeId")({
  validateSearch: zodValidator(z.object({ q: fallback(z.string(), "").default("") })),
  beforeLoad: () => requireAuth(),
  component: StorePage,
});

function StorePage() {
  const { storeId } = Route.useParams();
  const { q: initialQ } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQ || "");
  const [customOpen, setCustomOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cartState = useCart();

  const { data: store } = useQuery({ queryKey: ["store", storeId], queryFn: () => http.get<any>(`/stores/${storeId}`).then(snake) });
  const { data: products } = useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async (): Promise<any[]> => {
      // products carry the active offer merged in; category names come from the store's categories
      const [prods, cats] = await Promise.all([http.get<any[]>(`/stores/${storeId}/products`).then(snake), http.get<any[]>(`/stores/${storeId}/categories`).then(snake)]);
      const byId = new Map(cats.map((c: any) => [c.id, c.name]));
      return prods.map((p: any) => ({ ...p, categories: p.category_id ? { name: byId.get(p.category_id) } : null }));
    },
  });
  const { data: catalogCats } = useQuery({ queryKey: ["catalog-cats-lookup"], queryFn: () => http.get<any[]>("/catalog/categories").then(snake) });

  const catLookup = useMemo(() => {
    const m = new Map<string, { main_section: string | null; sort_order: number | null; image_url: string | null }>();
    (catalogCats ?? []).forEach((c: any) => {
      m.set(c.name, { main_section: c.main_section, sort_order: c.sort_order, image_url: c.image_url });
    });
    return m;
  }, [catalogCats]);

  const offerOf = (pid: string) => (products ?? []).find((p: any) => p.id === pid)?.offer ?? null;

  const filtered = (products ?? []).filter((p: any) => p.name.includes(q));

  // Build sections index over ALL store products (not filtered), used when search is empty.
  const { sectionsOrdered, productsBySection } = useMemo(() => {
    const bySection: Record<string, any[]> = {};
    const sectionMinOrder: Record<string, number> = {};
    (products ?? []).forEach((p: any) => {
      const catName = p.categories?.name;
      const info = catName ? catLookup.get(catName) : undefined;
      const section = info?.main_section || FALLBACK_SECTION;
      (bySection[section] ||= []).push(p);
      const so = info?.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sectionMinOrder[section] == null || so < sectionMinOrder[section]) {
        sectionMinOrder[section] = so;
      }
    });
    const ordered = Object.keys(bySection).sort((a, b) => {
      if (a === FALLBACK_SECTION) return 1;
      if (b === FALLBACK_SECTION) return -1;
      return (sectionMinOrder[a] ?? 0) - (sectionMinOrder[b] ?? 0);
    });
    return { sectionsOrdered: ordered, productsBySection: bySection };
  }, [products, catLookup]);

  useEffect(() => {
    if (!activeSection && sectionsOrdered.length > 0) {
      setActiveSection(sectionsOrdered[0]);
    } else if (activeSection && !sectionsOrdered.includes(activeSection)) {
      setActiveSection(sectionsOrdered[0] ?? null);
    }
  }, [sectionsOrdered, activeSection]);

  useEffect(() => {
    setSelectedCategory(null);
  }, [activeSection]);

  // For search results (flat grouped by category) - existing behavior
  const groupedSearch = filtered.reduce((acc: Record<string, any[]>, p: any) => {
    const k = (p as any).categories?.name || "منتجات";
    (acc[k] ||= []).push(p);
    return acc;
  }, {});

  // For section view: group selected section's products by category, ordered by catalog sort_order
  const sectionCategories = useMemo(() => {
    if (!activeSection) return [] as { name: string; items: any[] }[];
    const items = productsBySection[activeSection] ?? [];
    const byCat: Record<string, any[]> = {};
    items.forEach((p: any) => {
      const k = p.categories?.name || "منتجات";
      (byCat[k] ||= []).push(p);
    });
    return Object.keys(byCat)
      .sort((a, b) => {
        const oa = catLookup.get(a)?.sort_order ?? Number.MAX_SAFE_INTEGER;
        const ob = catLookup.get(b)?.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return a.localeCompare(b, "ar");
      })
      .map((name) => ({ name, items: byCat[name] }));
  }, [activeSection, productsBySection, catLookup]);

  const getQty = (id: string) => cartState.items.find((i) => i.productId === id)?.qty || 0;

  const renderProduct = (p: any) => {
    const qty = getQty(p.id);
    const offer = offerOf(p.id);
    const effectivePrice = offer ? Number(offer.discount_price) : Number(p.price);
    return (
      <Card key={p.id} className="p-3 space-y-2 relative">
        {offer && <span className="absolute top-1 left-1 z-10 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded">عرض</span>}
        <FavoriteButton type="product" id={p.id} className="absolute top-1 right-1 z-10" size={14} />
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-3xl">
          {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" /> : "🛒"}
        </div>
        <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-bold text-primary">{fmtRial(effectivePrice)}</span>
            {offer && <span className="text-[10px] text-muted-foreground line-through">{fmtRial(p.price)}</span>}
          </div>
          {!p.in_stock ? (
            <span className="text-[10px] text-destructive">نفد</span>
          ) : qty === 0 ? (
            <Button size="sm" onClick={() => {
              if (!store) return;
              cart.add(storeId, store.name, { productId: p.id, name: p.name, price: effectivePrice, qty: 1, imageUrl: p.image_url });
              toast.success("أضيف للسلة");
            }} className="h-8 w-8 p-0"><Plus className="w-4 h-4" /></Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => cart.setQty(p.id, qty - 1)}><Minus className="w-3 h-3" /></Button>
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <Button size="sm" className="h-7 w-7 p-0" onClick={() => cart.setQty(p.id, qty + 1)}><Plus className="w-3 h-3" /></Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  const searching = q.trim().length > 0;

  return (
    <CustomerShell title={store?.name || "متجر"} action={
      cartState.items.length > 0 && (
        <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/cart" })}>
          <ShoppingCart className="w-4 h-4 ml-1" />{fmtRial(cart.total())}
        </Button>
      )
    }>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <FavoriteButton type="store" id={storeId} />
          <p className="text-xs text-muted-foreground">{store?.area}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ابحث عن منتج..." value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.length > 0) setSelectedCategory(null); }} className="pr-9" />
          </div>
          <BarcodeSearchButton storeId={storeId} onFound={(name) => { setQ(name); setSelectedCategory(null); }} />
        </div>

        {searching ? (
          <>
            {Object.entries(groupedSearch).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="font-bold text-sm mb-2 text-primary">{cat}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {items.map(renderProduct)}
                </div>
              </div>
            ))}
          </>
        ) : sectionsOrdered.length > 0 ? (
          <div className="flex gap-3 items-start">
            <aside className="w-[96px] shrink-0 sticky top-[104px] self-start max-h-[calc(100vh-140px)] overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                {sectionsOrdered.map((s) => {
                  const active = s === activeSection;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSection(s)}
                      className={cn(
                        "text-[11px] leading-tight rounded-lg px-2 py-3 text-center transition min-h-[52px] flex items-center justify-center",
                        active
                          ? "bg-primary/10 text-primary font-bold border border-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      )}
                    >
                      <span className="line-clamp-2">{s}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="flex-1 min-w-0 space-y-4">
              {selectedCategory ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSelectedCategory(null)}>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <h2 className="font-bold text-base text-primary">{selectedCategory}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(sectionCategories.find((c) => c.name === selectedCategory)?.items ?? []).map(renderProduct)}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {sectionCategories.map(({ name }) => {
                    const img = catLookup.get(name)?.image_url;
                    return (
                      <Card
                        key={name}
                        onClick={() => setSelectedCategory(name)}
                        className="p-2 space-y-2 cursor-pointer hover:shadow-md transition"
                      >
                        <div className="aspect-square w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {img ? (
                            <img src={img} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-center line-clamp-2 min-h-[2rem]">{name}</div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <Button variant="outline" className="w-full" onClick={() => setCustomOpen(true)}>
          <MessageSquarePlus className="w-4 h-4 ml-2" /> طلب منتج غير موجود
        </Button>

        {(searching ? filtered.length === 0 : sectionsOrdered.length === 0) && (
          <Card className="p-8 text-center text-muted-foreground">لا توجد منتجات بعد.</Card>
        )}
      </div>

      <CustomRequestDialog open={customOpen} onClose={() => setCustomOpen(false)} storeId={storeId} />

    </CustomerShell>
  );
}
