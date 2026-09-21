import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { http, errorMessage } from "@/api/client";
import { getPermissionCatalog, type PermCatalog, type PermDef } from "@/api/admin";
import { useAuth } from "@/auth/store";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/admin/permissions")({ component: Page });

function groupDefs(defs: PermDef[]) {
  const g: { key: string; label: string; items: PermDef[] }[] = [];
  defs.forEach((d) => {
    let x = g.find((e) => e.key === d.grp);
    if (!x) { x = { key: d.grp, label: d.grpLabel, items: [] }; g.push(x); }
    x.items.push(d);
  });
  return g;
}

function PermPicker({ groups, selected, onToggle }: { groups: ReturnType<typeof groupDefs>; selected: Set<string>; onToggle: (perm: string, next: boolean) => void }) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.key} className="border rounded-lg p-2 space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">{g.label}</span>
          {g.items.map((d) => (
            <div key={d.perm} className="flex items-center justify-between gap-2">
              <span className="text-sm flex items-center gap-1">{d.label}{d.superOnly && <span className="text-[10px] text-muted-foreground">(للرئيسي فقط)</span>}</span>
              <Switch checked={d.superOnly ? false : selected.has(d.perm)} disabled={d.superOnly} onCheckedChange={(v) => onToggle(d.perm, v)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Page() {
  const { me } = useAuth();
  const isSuper = !!me?.super;
  const [catalog, setCatalog] = useState<PermCatalog | null>(null);
  const [edited, setEdited] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newPerms, setNewPerms] = useState<Set<string>>(new Set());

  const loadCatalog = useCallback(async () => {
    try {
      const c = await getPermissionCatalog();
      setCatalog(c);
      const e: Record<string, Set<string>> = {};
      (c.bundles || []).forEach((b) => { e[b.bundle] = new Set(b.perms || []); });
      setEdited(e);
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر التحميل"));
    }
  }, []);

  useEffect(() => { if (isSuper) loadCatalog(); }, [isSuper, loadCatalog]);

  if (!isSuper) {
    return <AdminShell title="إدارة الصلاحيات"><p className="text-center text-muted-foreground py-10">هذه الشاشة متاحة للمدير الرئيسي فقط.</p></AdminShell>;
  }

  const groups = groupDefs(catalog?.defs || []);

  const toggleEdited = (bundle: string, perm: string, next: boolean) => {
    setEdited((prev) => {
      const s = new Set(prev[bundle] || []); if (next) s.add(perm); else s.delete(perm);
      return { ...prev, [bundle]: s };
    });
  };
  const saveBundle = async (bundle: string) => {
    const b = catalog?.bundles.find((x) => x.bundle === bundle);
    setBusy("save-" + bundle);
    try {
      await http.put(`/admin/permissions/bundles/${bundle}`, { label: b?.label || bundle, perms: Array.from(edited[bundle] || []), sort: b?.sort ?? 0 });
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر الحفظ"));
      return;
    }
    setBusy(null);
    toast.success("تم حفظ المجموعة"); await loadCatalog();
  };
  const deleteBundle = async (bundle: string) => {
    setBusy("del-" + bundle);
    try {
      await http.del(`/admin/permissions/bundles/${bundle}`);
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر الحذف"));
      return;
    }
    setBusy(null);
    toast.success("تم حذف المجموعة"); await loadCatalog();
  };
  const createBundle = async () => {
    if (!newLabel.trim()) { toast.error("اسم المجموعة مطلوب"); return; }
    if (newPerms.size === 0) { toast.error("اختر صلاحية واحدة على الأقل"); return; }
    const key = "b_" + Math.random().toString(36).slice(2, 10);
    setBusy("create");
    try {
      await http.put(`/admin/permissions/bundles/${key}`, { label: newLabel.trim(), perms: Array.from(newPerms) });
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر الإنشاء"));
      return;
    }
    setBusy(null);
    toast.success("تم إنشاء المجموعة"); setNewLabel(""); setNewPerms(new Set()); await loadCatalog();
  };

  return (
    <AdminShell title="إدارة الصلاحيات">
      <Card className="p-3 mb-4 space-y-3">
        <div className="flex items-center gap-2"><Plus className="w-4 h-4" /><span className="font-medium">إنشاء مجموعة صلاحيات جديدة</span></div>
        <Input placeholder="اسم المجموعة (مثال: مدراء أقسام)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <PermPicker groups={groups} selected={newPerms} onToggle={(p, n) => setNewPerms((prev) => { const s = new Set(prev); if (n) s.add(p); else s.delete(p); return s; })} />
        <Button size="sm" disabled={busy === "create"} onClick={createBundle}>إنشاء المجموعة</Button>
      </Card>

      {!catalog ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
      ) : (catalog.bundles || []).length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا توجد مجموعات بعد.</p>
      ) : (
        <div className="space-y-3">
          {catalog.bundles.map((b) => (
            <Card key={b.bundle} className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{b.label}</span>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === "del-" + b.bundle} onClick={() => deleteBundle(b.bundle)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <PermPicker groups={groups} selected={edited[b.bundle] || new Set()} onToggle={(p, n) => toggleEdited(b.bundle, p, n)} />
              <Button size="sm" disabled={busy === "save-" + b.bundle} onClick={() => saveBundle(b.bundle)}>
                <Save className="w-4 h-4 ms-1" /> حفظ التغييرات
              </Button>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
