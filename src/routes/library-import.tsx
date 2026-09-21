import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import JSZip from "jszip";
import { http, errorMessage } from "@/api/client";
import { fetchAllCatalogItems, type BulkResult, type CatalogCategory } from "@/api/admin";
import { requireAdmin } from "@/auth/guards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Upload, Trash2, FileArchive, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/library-import")({
  beforeLoad: () => requireAdmin(),
  component: LibraryImportPage,
});

const CONCURRENCY = 5;
const RETRIES = 2;
const BULK_BATCH = 500;

type FileEntry = { category: string; fileName: string; baseName: string; blob: Blob };
type LogLine = { type: "info" | "error" | "ok"; text: string };
type PendingRow = { name: string; default_price: number; image_url: string; category_id: string; category_name: string; description: string; source: "library_import"; _label: string };

// Fix Arabic filenames stored without UTF-8 flag (JSZip decodes as CP437/latin1).
function fixArabicName(name: string, isUtf8: boolean): string {
  if (isUtf8) return name;
  try {
    const bytes = new Uint8Array(name.length);
    for (let i = 0; i < name.length; i++) bytes[i] = name.charCodeAt(i) & 0xff;
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // If it looks like Arabic/Unicode after re-decode, use it; else keep original.
    if (/[\u0600-\u06FF]/.test(decoded)) return decoded;
    return decoded || name;
  } catch { return name; }
}

function LibraryImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [summary, setSummary] = useState<null | {
    categoriesInserted: number;
    productsInserted: number;
    duplicatesRenamed: number;
    failures: number;
  }>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = (line: LogLine) => {
    setLogs((prev) => {
      const next = [...prev, line];
      queueMicrotask(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; });
      return next.slice(-500);
    });
  };

  const onFilePicked = async (f: File | null) => {
    setFile(f); setEntries([]); setSummary(null); setLogs([]);
    if (!f) return;
    setScanning(true);
    try {
      const zip = await JSZip.loadAsync(f, { createFolders: false });
      const raw: { path: string; isUtf8: boolean; entry: JSZip.JSZipObject }[] = [];
      zip.forEach((_relPath, entry) => {
        if (entry.dir) return;
        // Use JSZip's decoded name; fallback fix only when non-Arabic bytes leaked through.
        const path = entry.name;
        const looksBroken = /[\u00c0-\u00ff]{2,}/.test(path) && !/[\u0600-\u06FF]/.test(path);
        raw.push({ path: looksBroken ? fixArabicName(path, false) : path, isUtf8: !looksBroken, entry });
      });

      // Detect a single common root wrapper folder and strip it.
      const topLevels = new Set<string>();
      for (const r of raw) {
        const first = r.path.split("/")[0];
        if (first) topLevels.add(first);
      }
      const stripRoot = topLevels.size === 1 ? [...topLevels][0] + "/" : null;

      const acc: FileEntry[] = [];
      for (const r of raw) {
        let rel = stripRoot && r.path.startsWith(stripRoot) ? r.path.slice(stripRoot.length) : r.path;
        const parts = rel.split("/").filter(Boolean);
        if (parts.length < 2) continue; // need at least category/file
        const fileName = parts[parts.length - 1];
        if (!/\.(jpe?g|png|webp|gif)$/i.test(fileName)) continue;
        const category = parts[parts.length - 2]; // leaf folder = category
        const baseName = fileName.replace(/\.[^.]+$/, "").trim();
        if (!category || !baseName) continue;
        const blob = await r.entry.async("blob");
        acc.push({ category: category.trim(), fileName, baseName, blob });
      }
      setEntries(acc);
      addLog({ type: "info", text: `تم مسح ${acc.length} صورة في ${new Set(acc.map(e => e.category)).size} فئة.` });
    } catch (e: any) {
      toast.error("فشل قراءة الملف: " + (e?.message ?? "خطأ"));
    } finally {
      setScanning(false);
    }
  };

  const wipeAll = async () => {
    setWiping(true);
    try {
      addLog({ type: "info", text: "جارٍ حذف بيانات المكتبة القديمة..." });
      // one transactional call: catalog_items first (FK), then categories; stored files are left to the server's cleanup job
      const r = await http.post<{ deleted_items: number }>("/admin/catalog/wipe");
      addLog({ type: "ok", text: `تم حذف بيانات المكتبة القديمة (${r?.deleted_items ?? 0} منتج).` });
      toast.success("تم مسح المكتبة");
    } catch (e) {
      addLog({ type: "error", text: "فشل الحذف: " + errorMessage(e) });
      toast.error("فشل الحذف");
    } finally {
      setWiping(false); setWipeOpen(false);
    }
  };

  const runImport = async () => {
    if (!entries.length) return;
    setRunning(true); setSummary(null);
    setProgress({ done: 0, total: entries.length });
    let done = 0, productsInserted = 0, duplicatesRenamed = 0, failures = 0;
    let categoriesInserted = 0;

    // Preload existing categories & items to make resume-safe & dedupe fast.
    const catMap = new Map<string, string>(); // lowerName -> id
    const existingNames = new Set<string>(); // lower(name) globally (dedup index scope)
    try {
      const cats = await http.get<CatalogCategory[]>("/catalog/categories");
      cats.forEach((c) => catMap.set(c.name.trim().toLowerCase(), c.id));
      const items = await fetchAllCatalogItems();
      items.forEach((r) => existingNames.add(r.name.trim().toLowerCase()));
    } catch (e) {
      addLog({ type: "error", text: "تعذر تحميل المكتبة الحالية: " + errorMessage(e) });
      setRunning(false);
      return;
    }
    // Track (categoryId + lower(name)) done in this session
    const seenPerCat = new Set<string>();

    // Concurrent workers may hit the same new category; share one in-flight creation per name.
    const catInFlight = new Map<string, Promise<string>>();
    const ensureCategory = (name: string, sampleImageUrl: string | null): Promise<string> => {
      const key = name.trim().toLowerCase();
      const existing = catMap.get(key);
      if (existing) return Promise.resolve(existing);
      let p = catInFlight.get(key);
      if (!p) {
        p = http.post<{ id: string }>("/admin/catalog/categories", { name: name.trim(), image_url: sampleImageUrl }).then((row) => {
          catMap.set(key, row.id);
          categoriesInserted++;
          return row.id;
        }).finally(() => catInFlight.delete(key));
        catInFlight.set(key, p);
      }
      return p;
    };

    const uploadOne = async (e: FileEntry) => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
          const r = await http.upload<{ url: string }>("/admin/catalog/images", e.blob, e.fileName);
          return r.url;
        } catch (err) { lastErr = err; }
      }
      throw lastErr;
    };

    const pending: PendingRow[] = [];
    const processOne = async (e: FileEntry) => {
      try {
        // Skip if a same-name item exists globally (resume-safe & unique index safe)
        const lowerBase = e.baseName.toLowerCase();
        const combo = `${e.category.toLowerCase()}::${lowerBase}`;
        if (existingNames.has(lowerBase) && !seenPerCat.has(combo)) {
          // Consider existing => skip
          return;
        }
        // Determine final unique name (append " 1", " 2" ...)
        let finalName = e.baseName;
        let suffix = 0;
        while (existingNames.has(finalName.toLowerCase())) {
          suffix++;
          finalName = `${e.baseName} ${suffix}`;
        }
        if (suffix > 0) duplicatesRenamed++;

        const url = await uploadOne(e);
        const catId = await ensureCategory(e.category, url);

        pending.push({
          name: finalName, default_price: 0, image_url: url, category_id: catId, category_name: e.category,
          description: "", source: "library_import", _label: `${e.category}/${e.fileName}`,
        });
        existingNames.add(finalName.toLowerCase());
        seenPerCat.add(combo);
      } catch (err) {
        failures++;
        addLog({ type: "error", text: `فشل ${e.category}/${e.fileName}: ${errorMessage(err)}` });
      } finally {
        done++; setProgress({ done, total: entries.length });
      }
    };

    // Batched concurrency (uploads + category creation)
    const queue = [...entries];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        await processOne(item);
      }
    });
    await Promise.all(workers);

    // Insert the collected rows in bulk; the API reports per-row errors instead of failing the batch.
    addLog({ type: "info", text: `إدراج ${pending.length} منتج في المكتبة...` });
    for (let i = 0; i < pending.length; i += BULK_BATCH) {
      const batch = pending.slice(i, i + BULK_BATCH);
      try {
        const res = await http.post<BulkResult>("/admin/catalog/items/bulk", { rows: batch.map(({ _label, ...row }) => row) });
        productsInserted += Number(res.inserted || 0);
        for (const err of res.errors || []) {
          failures++;
          addLog({ type: "error", text: `فشل ${batch[err.index]?._label ?? "صف " + (i + err.index + 1)}: ${err.error}` });
        }
      } catch (e) {
        failures += batch.length;
        addLog({ type: "error", text: `فشل إدراج دفعة (${batch.length} منتج): ${errorMessage(e)}` });
      }
    }

    // Recompute sort_order alphabetically (categories via localeCompare on the client, items server-side).
    try {
      addLog({ type: "info", text: "ترتيب الفئات والمنتجات أبجدياً..." });
      const catsAll = await http.get<CatalogCategory[]>("/catalog/categories");
      const sortedCats = [...catsAll].sort((a, b) => a.name.localeCompare(b.name, "ar"));
      if (sortedCats.length) await http.post("/admin/catalog/categories/reorder", { ordered_ids: sortedCats.map((c) => c.id) });
      await http.post("/admin/catalog/items/normalize-sort");
    } catch (e) {
      addLog({ type: "error", text: "تعذر إعادة الترتيب: " + errorMessage(e) });
    }

    setSummary({ categoriesInserted, productsInserted, duplicatesRenamed, failures });
    setRunning(false);
    addLog({ type: "ok", text: `اكتمل الاستيراد. منتجات: ${productsInserted}، فئات: ${categoriesInserted}، فشل: ${failures}` });
    toast.success("اكتمل الاستيراد");
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const categoriesInZip = new Set(entries.map(e => e.category)).size;

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">استيراد مكتبة المنتجات</h1>
        <p className="text-sm text-muted-foreground">أداة إدارية لرفع مكتبة المنتجات من ملف ZIP.</p>
      </div>

      <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <div className="flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-medium">تنبيه</p>
            <p>الملف كبير الحجم (~210MB، ~2025 صورة). يُنصح باستخدام متصفح على جهاز حاسوب واتصال إنترنت مستقر. لا تُغلق الصفحة أثناء الرفع.</p>
            <p>هيكل الملف: كل مجلد = اسم فئة بالعربية، كل صورة داخله = اسم منتج بالعربية.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><FileArchive className="w-4 h-4" /> 1) اختر ملف ZIP</h2>
        <Input type="file" accept=".zip,application/zip" disabled={running || scanning}
          onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)} />
        {scanning && <p className="text-sm text-muted-foreground">جارٍ فحص الملف...</p>}
        {file && !scanning && (
          <div className="text-sm text-muted-foreground">
            الملف: <b>{file.name}</b> — {(file.size / (1024 * 1024)).toFixed(1)}MB — صور: <b>{entries.length}</b> — فئات: <b>{categoriesInZip}</b>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Trash2 className="w-4 h-4" /> 2) حذف بيانات المكتبة القديمة (اختياري)</h2>
        <p className="text-xs text-muted-foreground">يمسح <code>catalog_items</code> و <code>catalog_categories</code> وكل ملفات الحاوية <code>products-library</code>. لا يمس منتجات التجار.</p>
        <Button variant="destructive" onClick={() => setWipeOpen(true)} disabled={wiping || running}>
          <Trash2 className="w-4 h-4 ml-1" /> حذف بيانات المكتبة
        </Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> 3) بدء الاستيراد</h2>
        <Button onClick={runImport} disabled={!entries.length || running || scanning || wiping} className="w-full">
          {running ? `جارٍ الرفع... ${progress.done}/${progress.total}` : `ابدأ رفع ${entries.length} صورة`}
        </Button>
        {(running || progress.total > 0) && (
          <div className="space-y-1">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground text-center">{progress.done} / {progress.total} ({pct}%)</p>
          </div>
        )}
      </Card>

      {summary && (
        <Card className="p-4 bg-primary/5 border-primary/30 space-y-2">
          <h2 className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> ملخص الاستيراد</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>الفئات المضافة: <b>{summary.categoriesInserted}</b></div>
            <div>المنتجات المضافة: <b>{summary.productsInserted}</b></div>
            <div>مكررات تمت إعادة تسميتها: <b>{summary.duplicatesRenamed}</b></div>
            <div className={summary.failures ? "text-destructive" : ""}>الفشل: <b>{summary.failures}</b></div>
          </div>
        </Card>
      )}

      {logs.length > 0 && (
        <Card className="p-3">
          <h3 className="font-semibold text-sm mb-2">السجل</h3>
          <div ref={logRef} className="max-h-64 overflow-y-auto text-xs font-mono space-y-1 bg-muted/40 rounded p-2">
            {logs.map((l, i) => (
              <div key={i} className={l.type === "error" ? "text-destructive" : l.type === "ok" ? "text-primary" : "text-muted-foreground"}>
                {l.type === "error" ? <XCircle className="w-3 h-3 inline ml-1" /> : l.type === "ok" ? <CheckCircle2 className="w-3 h-3 inline ml-1" /> : "•"} {l.text}
              </div>
            ))}
          </div>
        </Card>
      )}

      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف الكامل</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف كل صفوف <b>catalog_items</b> و <b>catalog_categories</b> وكل الصور في حاوية <b>products-library</b>. لا يمكن التراجع. منتجات وفئات التجار لن تُمس.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={wipeAll} disabled={wiping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {wiping ? "جارٍ الحذف..." : "نعم، احذف الآن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
