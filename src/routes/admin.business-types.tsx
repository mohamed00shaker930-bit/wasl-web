import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowUp, ArrowDown, Plus, Trash2, Check, Pencil } from "lucide-react";
import { ApiError, http, errorMessage } from "@/api/client";
import type { BusinessCategory } from "@/api/admin";

export const Route = createFileRoute("/admin/business-types")({
  component: BusinessTypesPage,
});

type Row = BusinessCategory;

/** PUT /admin/business-categories/:id takes the full body (name_ar is required); patch on top of the current row. */
const update = (r: Row, patch: { name_ar?: string; is_active?: boolean; sort_order?: number }) =>
  http.put(`/admin/business-categories/${r.id}`, { name_ar: r.nameAr, slug: r.slug, is_active: r.isActive, sort_order: r.sortOrder, ...patch });

function BusinessTypesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await http.get<Row[]>("/admin/business-categories");
      setRows([...data].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      toast.error(errorMessage(e));
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sortOrder), 0);
    try {
      await http.post("/admin/business-categories", { name_ar: newName.trim(), slug: `type_${Date.now()}`, sort_order: maxOrder + 1, is_active: true });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e));
      return;
    }
    setBusy(false);
    setNewName(""); toast.success("تمت الإضافة"); load();
  };

  const rename = async (r: Row) => {
    if (!editName.trim()) return;
    try {
      await update(r, { name_ar: editName.trim() });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    setEditId(null); toast.success("تم التعديل"); load();
  };

  const toggle = async (r: Row) => {
    try {
      await update(r, { is_active: !r.isActive });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = rows[index + dir];
    const cur = rows[index];
    if (!other || !cur) return;
    const [a, b] = [cur.sortOrder, other.sortOrder];
    try {
      await update(cur, { sort_order: b });
      await update(other, { sort_order: a });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    try {
      await http.del(`/admin/business-categories/${id}`);
      toast.success("تم الحذف");
      load();
    } catch (e) {
      // 409 conflict: referenced by profiles/stores → hiding is the supported path
      toast.error(e instanceof ApiError && e.code === "conflict" ? "لا يمكن حذف نوع مرتبط بحسابات، قم بإخفائه بدلاً من ذلك" : errorMessage(e));
    }
  };

  return (
    <AdminShell title="أنواع الأنشطة">
      <Card className="p-3 flex gap-2 mb-4">
        <Input placeholder="اسم النوع الجديد" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={!newName.trim() || busy}><Plus className="w-4 h-4 ml-1" />إضافة</Button>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد أنواع أنشطة</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <Card key={r.id} className="p-3 flex items-center gap-2">
              <div className="flex flex-col">
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                {editId === r.id ? (
                  <div className="flex gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && rename(r)} />
                    <Button size="icon" onClick={() => rename(r)}><Check className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <p className={`font-medium ${r.isActive ? "" : "text-muted-foreground line-through"}`}>{r.nameAr}</p>
                )}
              </div>
              {editId !== r.id && (
                <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setEditName(r.nameAr); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              <Switch checked={r.isActive} onCheckedChange={() => toggle(r)} />
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setToDelete(r)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نوع النشاط</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف «{toDelete?.nameAr}»؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
