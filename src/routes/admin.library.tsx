import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { http, errorMessage } from "@/api/client";
import { fetchAllCatalogItems, listCatalogItems, type BulkResult, type CatalogCategory, type CatalogItem } from "@/api/admin";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, ArrowUp, ArrowDown, Image as ImageIcon,
  ChevronLeft, ChevronRight, Package, Search, Download, Upload, Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin/library")({ component: LibraryPage });

const PAGE_SIZE = 50;
const DEFAULT_SECTIONS = [
  "المقاضي",
  "الإحتياجات اليومية",
  "الاساسيات المنزلية",
  "التسالى والحلويات",
  "الجمال والعناية الشخصية",
  "المشروبات",
];

type Category = CatalogCategory;
type Item = CatalogItem;

const loadCategories = () => http.get<Category[]>("/catalog/categories");

// -------- image helpers --------
async function compressImage(file: File, maxW = 800): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b || file), "image/webp", 0.85)!
  );
  return blob;
}

/** Compresses client-side then stores through the API (bucket products-library); the old file is left to the server cleanup. */
async function uploadImage(file: File): Promise<string> {
  const blob = await compressImage(file, 800);
  const r = await http.upload<{ url: string }>("/admin/catalog/images", blob, `${crypto.randomUUID().replace(/-/g, "")}.webp`);
  return r.url;
}

function LibraryPage() {
  return (
    <AdminShell title="إدارة المكتبة">
      <Tabs defaultValue="cats" className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="cats">الفئات</TabsTrigger>
          <TabsTrigger value="items">المنتجات</TabsTrigger>
        </TabsList>
        <TabsContent value="cats"><CategoriesTab /></TabsContent>
        <TabsContent value="items"><ItemsTab /></TabsContent>
      </Tabs>
    </AdminShell>
  );
}

// ========== Categories ==========
function CategoriesTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setCats(await loadCategories());
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sections = useMemo(() => {
    const s = new Set<string>(DEFAULT_SECTIONS);
    cats.forEach((c) => c.mainSection && s.add(c.mainSection));
    return Array.from(s);
  }, [cats]);

  /** Swapping two neighbours = sending the whole order with the pair exchanged. */
  const swap = async (i: number, j: number) => {
    const ids = cats.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await http.post("/admin/catalog/categories/reorder", { ordered_ids: ids });
    } catch (e) {
      toast.error(errorMessage(e));
    }
    load();
  };

  const moveUp = (i: number) => { if (i > 0) swap(i, i - 1); };
  const moveDown = (i: number) => { if (i < cats.length - 1) swap(i, i + 1); };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{cats.length} فئة</p>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 ml-1" />إضافة فئة</Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">جاري التحميل...</Card>
      ) : cats.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">لا فئات</Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cats.map((c, i) => (
            <Card key={c.id} className="p-3 space-y-2">
              <div className="aspect-square w-full rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-bold text-sm line-clamp-1">{c.name}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{c.mainSection || "بلا قسم"}</p>
                <p className="text-[11px] text-primary">{Number(c.itemsCount || 0)} منتج</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1 h-8 px-1" onClick={() => setEditing(c)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => moveUp(i)} disabled={i === 0}>
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => moveDown(i)} disabled={i === cats.length - 1}>
                  <ArrowDown className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDeleteTarget(c)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        category={editing}
        sections={sections}
        nextSortOrder={(cats[cats.length - 1]?.sortOrder ?? 0) + 1}
        onSaved={load}
      />

      <DeleteCategoryDialog
        target={deleteTarget}
        productCount={deleteTarget ? Number(deleteTarget.itemsCount || 0) : 0}
        otherCats={cats.filter((c) => c.id !== deleteTarget?.id)}
        onClose={() => setDeleteTarget(null)}
        onDone={load}
      />
    </div>
  );
}

function CategoryDialog({
  open, onClose, category, sections, nextSortOrder, onSaved,
}: {
  open: boolean; onClose: () => void; category: Category | null;
  sections: string[]; nextSortOrder: number; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [mainSection, setMainSection] = useState<string>("");
  const [customSection, setCustomSection] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(category?.name || "");
      setMainSection(category?.mainSection && sections.includes(category.mainSection) ? category.mainSection : (category?.mainSection ? "__custom" : ""));
      setCustomSection(category?.mainSection && !sections.includes(category.mainSection) ? category.mainSection : "");
      setImageUrl(category?.imageUrl || null);
    }
  }, [open, category]);

  const onPickImage = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setImageUrl(url);
    } catch (e) {
      toast.error(errorMessage(e, "فشل الرفع"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) { toast.error("أدخل اسم الفئة"); return; }
    const finalSection = mainSection === "__custom" ? customSection.trim() : mainSection.trim();
    setSaving(true);
    try {
      if (category) {
        await http.put(`/admin/catalog/categories/${category.id}`, {
          name: name.trim(),
          main_section: finalSection || null,
          image_url: imageUrl,
          icon: category.icon,
          parent_category: category.parentCategory,
        });
        toast.success("تم التحديث");
      } else {
        await http.post("/admin/catalog/categories", {
          name: name.trim(),
          main_section: finalSection || null,
          image_url: imageUrl,
          sort_order: nextSortOrder,
        });
        toast.success("تمت الإضافة");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "فشل الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{category ? "تعديل فئة" : "إضافة فئة"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>القسم الرئيسي</Label>
            <Select value={mainSection} onValueChange={setMainSection}>
              <SelectTrigger><SelectValue placeholder="اختر قسماً" /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="__custom">+ قسم جديد</SelectItem>
              </SelectContent>
            </Select>
            {mainSection === "__custom" && (
              <Input className="mt-2" placeholder="اسم القسم الجديد" value={customSection} onChange={(e) => setCustomSection(e.target.value)} />
            )}
          </div>
          <div>
            <Label>الصورة</Label>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "جاري الرفع..." : "رفع صورة"}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({
  target, productCount, otherCats, onClose, onDone,
}: {
  target: Category | null; productCount: number;
  otherCats: Category[]; onClose: () => void; onDone: () => void;
}) {
  const [moveTo, setMoveTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (target) setMoveTo(""); }, [target]);

  const doDelete = async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (productCount > 0 && !moveTo) { toast.error("اختر فئة النقل"); setBusy(false); return; }
      // the API re-parents the category's items to `move_to` inside the same transaction
      await http.del(`/admin/catalog/categories/${target.id}${productCount > 0 ? `?move_to=${encodeURIComponent(moveTo)}` : ""}`);
      toast.success("تم الحذف");
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e, "فشل الحذف"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الفئة "{target?.name}"</AlertDialogTitle>
          <AlertDialogDescription>
            {productCount > 0
              ? `هذه الفئة تحتوي ${productCount} منتج. اختر فئة أخرى لنقل المنتجات إليها قبل الحذف.`
              : "لا منتجات في هذه الفئة. سيتم الحذف مباشرة."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {productCount > 0 && (
          <div>
            <Label>نقل المنتجات إلى</Label>
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
              <SelectContent>
                {otherCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); doDelete(); }} disabled={busy}>
            {busy ? "جاري..." : "حذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ========== Items ==========
type SortKey = "newest" | "name" | "usage";

function ItemsTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    loadCategories().then(setCats).catch(() => setCats([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listCatalogItems({
        q: q.trim() || undefined,
        category_id: categoryFilter === "__all" ? undefined : categoryFilter,
        page: page + 1,
        limit: PAGE_SIZE,
        sort: sortBy,
      });
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      toast.error(errorMessage(e));
      setItems([]); setTotal(0);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [page, q, categoryFilter, sortBy]);

  useEffect(() => { setPage(0); }, [q, categoryFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSearch = (e: React.FormEvent) => { e.preventDefault(); setQ(qInput); };

  const del = async () => {
    if (!deleteTarget) return;
    try {
      await http.del(`/admin/catalog/items/${deleteTarget.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("تم الحذف");
    setDeleteTarget(null);
    load();
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAllCatalogItems();
      const cmp = (a: string | null, b: string | null) => {
        if (a == null && b == null) return 0;
        if (a == null) return 1;
        if (b == null) return -1;
        return a.localeCompare(b, "ar");
      };
      all.sort((a, b) => cmp(a.mainSection, b.mainSection) || cmp(a.categoryPath, b.categoryPath) || a.name.localeCompare(b.name, "ar"));
      const headers = [
        "المعرف (لا تعدّله)", "اسم المنتج", "الباركود", "السعر", "الوصف",
        "القسم الرئيسي", "الفئة", "الفئة الفرعية", "اسم الفئة",
        "رابط الصورة", "عدد الاستخدام", "الترتيب", "المصدر", "تاريخ الإضافة",
      ];
      const aoa: any[][] = [headers];
      for (const r of all) {
        aoa.push([
          r.id ?? "",
          r.name ?? "",
          r.barcode ?? "",
          r.defaultPrice == null ? "" : Number(r.defaultPrice),
          r.description ?? "",
          r.mainSection ?? "",
          r.categoryPath ?? "",
          r.subcategory ?? "",
          r.categoryName ?? "",
          r.imageUrl ?? "",
          r.usageCount ?? "",
          r.sortOrder ?? "",
          r.source ?? "",
          r.createdAt ?? "",
        ]);
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // Force id (col A) and barcode (col C) to text
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let R = 1; R <= range.e.r; R++) {
        for (const C of [0, 2]) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (cell && cell.v != null && cell.v !== "") {
            cell.t = "s";
            cell.v = String(cell.v);
            cell.z = "@";
          }
        }
      }
      ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 6)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "المنتجات");
      XLSX.writeFile(wb, "wasl-library.xlsx");
      toast.success(`تم تصدير ${all.length} منتج`);
    } catch (e) {
      toast.error(errorMessage(e, "فشل التصدير"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2">
        <form onSubmit={onSearch} className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الباركود..." value={qInput} onChange={(e) => setQInput(e.target.value)} className="pr-9" />
        </form>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="الفرز" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="name">الاسم: أ → ي</SelectItem>
            <SelectItem value="usage">الأكثر استخداماً</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="الفئة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">كل الفئات</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportExcel} disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Download className="w-4 h-4 ml-1" />}
          تصدير Excel
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 ml-1" />استيراد Excel
        </Button>
        <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 ml-1" />إضافة منتج</Button>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">صورة</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">الباركود</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا منتجات</TableCell></TableRow>
            ) : items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <div className="w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
                    {it.imageUrl ? <img src={it.imageUrl} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{it.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{it.categoryName || "—"}</TableCell>
                <TableCell className="text-xs">{it.barcode || "—"}</TableCell>
                <TableCell className="text-xs">{Number(it.defaultPrice ?? 0)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setEditing(it)}><Pencil className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDeleteTarget(it)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} منتج · صفحة {page + 1} من {totalPages}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}><ChevronLeft className="w-4 h-4" /></Button>
        </div>
      </div>

      <ItemDialog
        open={addOpen || !!editing}
        onClose={() => { setAddOpen(false); setEditing(null); }}
        item={editing}
        cats={cats}
        onSaved={load}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنتج</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف "{deleteTarget?.name}" من المكتبة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); del(); }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ItemDialog({
  open, onClose, item, cats, onSaved,
}: {
  open: boolean; onClose: () => void; item: Item | null;
  cats: Category[]; onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(item?.name || "");
      setCategoryId(item?.categoryId || "");
      setBarcode(item?.barcode || "");
      setPrice(String(Number(item?.defaultPrice ?? 0)));
      setDescription(item?.description || "");
      setImageUrl(item?.imageUrl || null);
    }
  }, [open, item]);

  const onPickImage = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImage(f);
      setImageUrl(url);
    } catch (e) {
      toast.error(errorMessage(e, "فشل الرفع"));
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!name.trim()) { toast.error("أدخل اسم المنتج"); return; }
    setSaving(true);
    try {
      const cat = cats.find((c) => c.id === categoryId);
      const payload = {
        name: name.trim(),
        barcode: barcode.trim() || null,
        default_price: Number(price) || 0,
        description: description,
        image_url: imageUrl,
        category_id: categoryId || null,
        category_name: cat?.name || null,
        main_section: cat?.mainSection || null,
      };
      if (item) {
        await http.put(`/admin/catalog/items/${item.id}`, payload);
        toast.success("تم التحديث");
      } else {
        await http.post("/admin/catalog/items", payload);
        toast.success("تمت الإضافة");
      }
      onSaved(); onClose();
    } catch (e) {
      toast.error(errorMessage(e, "فشل الحفظ"));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>{item ? "تعديل منتج" : "إضافة منتج"}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>الفئة</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الباركود</Label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div>
            <Label>السعر الافتراضي</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>الصورة</Label>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "جاري..." : "رفع صورة"}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Bulk Import Dialog ==========
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASON_AR: Record<string, string> = {
  not_found: "المنتج غير موجود",
  duplicate: "الاسم/الباركود مكرر مع منتج آخر",
  invalid_price: "سعر غير صالح",
  missing_id: "المعرف مفقود",
  name_required: "اسم المنتج مطلوب",
};

type ImportError = { id?: string; name?: string; reason: string };

function normalizeBarcode(v: any): string {
  if (v == null) return "";
  let s = String(v).trim();
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
  return s;
}

function ImportDialog({
  open, onClose, onDone,
}: { open: boolean; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [summary, setSummary] = useState<{ updated: number; unchanged: number; errors: ImportError[] } | null>(null);

  const reset = () => { setBusy(false); setProgress(0); setPhase(""); setSummary(null); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const handleFile = async (file: File) => {
    setBusy(true); setSummary(null); setProgress(0); setPhase("قراءة الملف...");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("ورقة العمل فارغة");
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null });

      const errors: ImportError[] = [];
      const dedupe = new Map<string, number>();
      const parsed: { id: string; name?: string; barcode?: string | null; price?: number | null }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const id = String(r["المعرف (لا تعدّله)"] ?? "").trim();
        const nameRaw = r["اسم المنتج"];
        const barcodeRaw = r["الباركود"];
        const priceRaw = r["السعر"];
        if (!id) { errors.push({ name: nameRaw ? String(nameRaw) : `صف ${i + 2}`, reason: "missing_id" }); continue; }
        if (!UUID_RE.test(id)) { errors.push({ id, name: nameRaw ? String(nameRaw) : undefined, reason: "missing_id" }); continue; }

        const name = nameRaw != null && String(nameRaw).trim() !== "" ? String(nameRaw).trim() : undefined;
        const barcode = barcodeRaw != null && String(barcodeRaw).trim() !== "" ? normalizeBarcode(barcodeRaw) : undefined;
        let price: number | undefined = undefined;
        if (priceRaw != null && String(priceRaw).trim() !== "") {
          const n = Number(String(priceRaw).replace(/,/g, ""));
          if (isNaN(n) || n < 0) { errors.push({ id, name, reason: "invalid_price" }); continue; }
          price = n;
        }

        // Dedupe inside file
        const key = `${(name ?? "").toLowerCase()}|${barcode ?? ""}`;
        if (name || barcode) {
          const prev = dedupe.get(key);
          if (prev != null) {
            errors.push({ id, name, reason: "duplicate" });
            continue;
          }
          dedupe.set(key, i);
        }

        parsed.push({ id, name, barcode: barcode ?? undefined, price });
      }

      if (parsed.length === 0) {
        setSummary({ updated: 0, unchanged: 0, errors });
        setBusy(false);
        return;
      }

      // Fetch current values (the catalog read API is paged, so the whole library is walked once)
      setPhase("جلب القيم الحالية...");
      const currentMap = new Map<string, { name: string; barcode: string | null; default_price: number }>();
      const all = await fetchAllCatalogItems((loaded, total) => setProgress(Math.round((loaded / Math.max(total, 1)) * 30)));
      all.forEach((r) => currentMap.set(r.id, { name: r.name, barcode: r.barcode, default_price: Number(r.defaultPrice ?? 0) }));

      // Build change set: only rows where at least one field actually differs
      const changed: { id: string; name?: string; barcode?: string | null; default_price?: number; _name?: string }[] = [];
      let unchanged = 0;
      for (const p of parsed) {
        const cur = currentMap.get(p.id);
        if (!cur) { errors.push({ id: p.id, name: p.name, reason: "not_found" }); continue; }
        const patch: { id: string; name?: string; barcode?: string | null; default_price?: number; _name?: string } = { id: p.id, _name: p.name ?? cur.name };
        let diff = false;
        if (p.name != null && p.name !== cur.name) { patch.name = p.name; diff = true; }
        if (p.barcode !== undefined) {
          const nb = p.barcode ?? null;
          if ((cur.barcode ?? null) !== nb) { patch.barcode = nb; diff = true; }
        }
        if (p.price != null && Number(cur.default_price) !== p.price) { patch.default_price = p.price; diff = true; }
        if (diff) changed.push(patch); else unchanged++;
      }

      // Send batches
      setPhase("إرسال التعديلات...");
      let updated = 0;
      const BATCH = 500;
      for (let i = 0; i < changed.length; i += BATCH) {
        const batch = changed.slice(i, i + BATCH);
        const res = await http.post<BulkResult>("/admin/catalog/items/bulk", { rows: batch.map(({ _name, ...row }) => row) });
        updated += Number(res.updated || 0);
        for (const e of res.errors || []) {
          const src = batch[e.index];
          errors.push({ id: src?.id, name: src?._name, reason: e.error });
        }
        setProgress(30 + Math.round(((i + batch.length) / changed.length) * 70));
      }

      setSummary({ updated, unchanged, errors });
      toast.success(`تم تحديث ${updated} منتج`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error && !("code" in e) ? e.message : errorMessage(e, "فشل الاستيراد"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadErrors = () => {
    if (!summary) return;
    const aoa: any[][] = [["اسم المنتج", "المعرف", "السبب"]];
    for (const e of summary.errors) aoa.push([e.name || "", e.id || "", REASON_AR[e.reason] || e.reason]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الأخطاء");
    XLSX.writeFile(wb, "wasl-library-errors.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle>استيراد Excel (تعديل جماعي)</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
            <li>صدّر الملف أولاً من زر "تصدير Excel".</li>
            <li>عدّل فقط الأعمدة: <b>اسم المنتج</b>، <b>الباركود</b>، <b>السعر</b>.</li>
            <li>لا تغيّر ولا تحذف عمود <b>"المعرف (لا تعدّله)"</b>.</li>
            <li>الخلية الفارغة تعني إبقاء القيمة الحالية كما هي.</li>
          </ol>

          {!busy && !summary && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Button onClick={() => fileRef.current?.click()} className="w-full">
                <Upload className="w-4 h-4 ml-1" />اختر ملف Excel
              </Button>
            </div>
          )}

          {busy && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{phase}</p>
              <Progress value={progress} />
              <p className="text-xs text-center">{progress}%</p>
            </div>
          )}

          {summary && !busy && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">محدّثة</p>
                  <p className="text-lg font-bold text-primary">{summary.updated}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">بدون تغيير</p>
                  <p className="text-lg font-bold">{summary.unchanged}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">أخطاء</p>
                  <p className="text-lg font-bold text-destructive">{summary.errors.length}</p>
                </Card>
              </div>
              {summary.errors.length > 0 && (
                <>
                  <div className="max-h-52 overflow-y-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المنتج</TableHead>
                          <TableHead className="text-right">السبب</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.errors.map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{e.name || e.id || "—"}</TableCell>
                            <TableCell className="text-xs text-destructive">{REASON_AR[e.reason] || e.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button variant="outline" onClick={downloadErrors} className="w-full">
                    <Download className="w-4 h-4 ml-1" />تنزيل الأخطاء
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            {summary ? "إغلاق" : "إلغاء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
