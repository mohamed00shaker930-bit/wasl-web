import { useState, useMemo, useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import type { CatalogCategoryRow, CatalogItemRow } from "@/api/merchant";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtRial } from "@/lib/format";
import { Search, Package } from "lucide-react";
import { toast } from "sonner";

const PAGE = 200; // API max per page

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the server-side import succeeded (the caller refreshes its queries). */
  onImported: (result: { imported: number; skipped: number; categories: number }) => void;
}

/**
 * Shared product library → the merchant's store. Items are imported with POST /merchant/products/import-from-catalog
 * (the API creates store categories from each item's category_name); catalog categories picked on their own are
 * created as empty store categories via POST /merchant/categories, as the old client did.
 */
export function CatalogPicker({ open, onClose, onImported }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [pickedItems, setPickedItems] = useState<Record<string, CatalogItemRow>>({});
  const [pickedCats, setPickedCats] = useState<Record<string, CatalogCategoryRow>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const itemsQuery = useInfiniteQuery({
    queryKey: ["catalog-items", debounced, catFilter],
    enabled: open,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => http.get<{ items: CatalogItemRow[]; total: number; page: number; limit: number }>("/catalog/items", {
      q: debounced || undefined, category_id: catFilter ?? undefined, page: pageParam, limit: PAGE, sort: "name",
    }),
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
  const items = useMemo(() => itemsQuery.data?.pages.flatMap((p) => p.items) ?? [], [itemsQuery.data]);
  const totalItems = itemsQuery.data?.pages[0]?.total ?? 0;

  const { data: cats = [] } = useQuery({
    queryKey: ["catalog-cats"], enabled: open,
    queryFn: () => http.get<CatalogCategoryRow[]>("/catalog/categories"),
  });

  const filteredCats = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sorted = [...cats].sort((a, b) => b.usageCount - a.usageCount);
    if (!s) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(s));
  }, [cats, q]);

  const total = Object.keys(pickedItems).length + Object.keys(pickedCats).length;

  const reset = () => { setPickedItems({}); setPickedCats({}); setQ(""); setCatFilter(null); };
  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const ids = Object.keys(pickedItems);
      let imported = 0, skipped = 0;
      if (ids.length) {
        const r = await http.post<{ imported: number; skipped: number }>("/merchant/products/import-from-catalog", { catalog_item_ids: ids });
        imported = r.imported; skipped = r.skipped;
      }
      // Categories picked without items: create them in the store (import-from-catalog only creates the ones its items use).
      const existing = ids.length || Object.keys(pickedCats).length ? await http.get<{ id: string; name: string }[]>("/merchant/categories") : [];
      const have = new Set(existing.map((c) => c.name.trim().toLowerCase()));
      let categories = 0;
      for (const c of Object.values(pickedCats)) {
        const key = c.name.trim().toLowerCase();
        if (have.has(key)) continue;
        await http.post("/merchant/categories", { name: c.name.trim(), sort_order: existing.length + categories });
        have.add(key); categories++;
      }
      toast.success(`أُضيف ${imported} منتج و ${categories} فئة${skipped ? ` (تم تخطي ${skipped} مكرر)` : ""}`);
      onImported({ imported, skipped, categories });
      reset();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>استيراد من المكتبة</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الباركود" className="pr-9" />
        </div>
        <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="items">منتجات ({totalItems})</TabsTrigger>
            <TabsTrigger value="cats">فئات ({filteredCats.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="items" className="flex-1 overflow-y-auto space-y-1 mt-2">
            {cats.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                <Button size="sm" variant={catFilter === null ? "default" : "outline"} className="h-7 text-xs shrink-0" onClick={() => setCatFilter(null)}>الكل</Button>
                {cats.map((c) => (
                  <Button key={c.id} size="sm" variant={catFilter === c.id ? "default" : "outline"} className="h-7 text-xs shrink-0" onClick={() => setCatFilter(c.id)}>
                    {c.icon ?? ""} {c.name}
                  </Button>
                ))}
              </div>
            )}
            {items.length > 0 && (() => {
              const allChecked = items.every((i) => pickedItems[i.id]);
              return (
                <label className="flex items-center gap-2 p-2 rounded bg-accent/50 cursor-pointer sticky top-0 z-10">
                  <Checkbox checked={allChecked} onCheckedChange={(v) => {
                    setPickedItems((p) => {
                      const n = {...p};
                      if (v) items.forEach((it) => { n[it.id] = it; });
                      else items.forEach((it) => { delete n[it.id]; });
                      return n;
                    });
                  }} />
                  <span className="text-sm font-medium">{allChecked ? "إلغاء تحديد الكل" : `تحديد الكل (${items.length})`}</span>
                </label>
              );
            })()}
            {items.length === 0 && !itemsQuery.isLoading && <p className="text-center text-sm text-muted-foreground py-8">لا منتجات</p>}
            {itemsQuery.isLoading && <p className="text-center text-sm text-muted-foreground py-8">جاري التحميل...</p>}
            {items.map((it) => {
              const checked = !!pickedItems[it.id];
              return (
                <label key={it.id} className="flex items-center gap-2 p-2 rounded border hover:bg-accent cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    setPickedItems((p) => { const n = {...p}; if (v) n[it.id] = it; else delete n[it.id]; return n; });
                  }} />
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden">
                    {it.imageUrl ? <img src={it.imageUrl} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.categoryName ?? "—"} · {fmtRial(it.defaultPrice)}</p>
                  </div>
                </label>
              );
            })}
            {itemsQuery.hasNextPage && (
              <Button variant="outline" className="w-full" disabled={itemsQuery.isFetchingNextPage} onClick={() => itemsQuery.fetchNextPage()}>
                {itemsQuery.isFetchingNextPage ? "جاري التحميل..." : `تحميل المزيد (${items.length}/${totalItems})`}
              </Button>
            )}
          </TabsContent>

          <TabsContent value="cats" className="flex-1 overflow-y-auto space-y-1 mt-2">
            {filteredCats.length > 0 && (() => {
              const allChecked = filteredCats.every((c) => pickedCats[c.id]);
              return (
                <label className="flex items-center gap-2 p-2 rounded bg-accent/50 cursor-pointer sticky top-0 z-10">
                  <Checkbox checked={allChecked} onCheckedChange={(v) => {
                    setPickedCats((p) => {
                      const n = {...p};
                      if (v) filteredCats.forEach((c) => { n[c.id] = c; });
                      else filteredCats.forEach((c) => { delete n[c.id]; });
                      return n;
                    });
                  }} />
                  <span className="text-sm font-medium">{allChecked ? "إلغاء تحديد الكل" : `تحديد الكل (${filteredCats.length})`}</span>
                </label>
              );
            })()}
            {filteredCats.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">لا فئات</p>}
            {filteredCats.map((c) => {
              const checked = !!pickedCats[c.id];
              return (
                <label key={c.id} className="flex items-center gap-2 p-2 rounded border hover:bg-accent cursor-pointer">
                  <Checkbox checked={checked} onCheckedChange={(v) => {
                    setPickedCats((p) => { const n = {...p}; if (v) n[c.id] = c; else delete n[c.id]; return n; });
                  }} />
                  <span className="text-xl">{c.icon ?? "📦"}</span>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.itemsCount} منتج</span>
                </label>
              );
            })}
          </TabsContent>

        </Tabs>
        <Button onClick={handleImport} disabled={total === 0 || importing} className="w-full">
          {importing ? "جاري الاستيراد..." : `استيراد المحدد (${total})`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
