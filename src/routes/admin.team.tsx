import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { http, errorMessage } from "@/api/client";
import { getPermissionCatalog, listUsers, type AdminUserRow } from "@/api/admin";
import { toast } from "sonner";
import { formatDateTimeFull } from "@/lib/dateFormat";
import { Shield, UserPlus } from "lucide-react";
import { RolesDialog, STAFF_ROLES, ROLE_LABEL, type RolesDialogUser } from "@/components/admin/RolesDialog";

export const Route = createFileRoute("/admin/team")({ component: Page });

const PAGE_SIZE = 50;

function Page() {
  const [role, setRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<RolesDialogUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [role, debounced]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listUsers({
        kind: "staff",
        role: role ?? undefined,
        search: debounced.length >= 2 ? debounced : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(r.items);
      setTotal(r.total);
    } catch (e) {
      toast.error(errorMessage(e));
      setRows([]); setTotal(0);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role, debounced, page]);

  const chips = useMemo(() => {
    const base: Array<{ key: string; label: string; active: boolean; onClick: () => void }> = [
      { key: "all", label: "الكل", active: role === null, onClick: () => setRole(null) },
    ];
    STAFF_ROLES.forEach((r) => {
      base.push({
        key: r.key,
        label: r.label,
        active: role === r.key,
        onClick: () => setRole(r.key),
      });
    });
    return base;
  }, [role]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell
      title="فريق الإدارة"
      action={
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <UserPlus className="w-4 h-4 ms-1" /> إضافة موظف
        </Button>
      }
    >
      <div className="mb-3 -mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          {chips.map((c) => (
            <Button key={c.key} size="sm" variant={c.active ? "default" : "outline"} onClick={c.onClick} className="shrink-0">
              {c.label}
              {c.active && <Badge variant="secondary" className="mr-1 ms-1">{total}</Badge>}
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <Input placeholder="ابحث بالاسم أو رقم الجوال" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">لا نتائج</p>
      ) : (
        <div className="space-y-2">
          {rows.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{u.name || "—"}</p>
                    <Badge className="bg-violet-100 text-violet-700">
                      <Shield className="w-3 h-3 ms-1" />إدارة
                    </Badge>
                    {(u.roles || []).map((r) => (
                      <Badge key={r} variant="outline">{ROLE_LABEL[r] || r}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {u.phone || "—"} • مسجّل {formatDateTimeFull(u.createdAt)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditing({ user_id: u.id, name: u.name, phone: u.phone, roles: u.roles })}>
                  إدارة الصلاحيات
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            السابق
          </Button>
          <span className="text-xs text-muted-foreground">
            صفحة {page + 1} من {totalPages} • {total} نتيجة
          </span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </div>
      )}

      <RolesDialog user={editing} onClose={() => setEditing(null)} onChanged={load} />
      <AddStaffDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />
    </AdminShell>
  );
}

function AddStaffDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [bundle, setBundle] = useState("");
  const [bundles, setBundles] = useState<{ bundle: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setPhone(""); setPassword(""); setName(""); setBundle(""); setRole("admin"); return; }
    (async () => {
      try {
        const c = await getPermissionCatalog();
        setBundles((c.bundles || []).map((b) => ({ bundle: b.bundle, label: b.label })));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    })();
  }, [open]);

  const create = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!/^\d{9,15}$/.test(phone.replace(/\D/g, ""))) { toast.error("رقم الجوال غير صحيح"); return; }
    if (password.length < 6) { toast.error("كلمة المرور قصيرة"); return; }
    setBusy(true);
    try {
      await http.post("/admin/staff", { phone: phone.replace(/\D/g, ""), password, name: name.trim(), role, ...(bundle ? { bundle } : {}) });
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e, "تعذّر إنشاء الموظف"));
      return;
    }
    setBusy(false);
    toast.success("تم إنشاء الموظف بنجاح");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة موظف</DialogTitle>
          <DialogDescription>أنشئ حساب موظف جديدًا من الصفر وعيّن له مجموعة صلاحيات. لا يمكن ترقية عميل أو تاجر موجود.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">الاسم</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">رقم الجوال</label>
            <Input inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7XXXXXXXX" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">كلمة المرور</label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="٦ أحرف على الأقل" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">الدور</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.filter((r) => r.key !== "super_admin").map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">مجموعة الصلاحيات</label>
            <Select value={bundle || "__none"} onValueChange={(v) => setBundle(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">بدون (صفر صلاحيات)</SelectItem>
                {bundles.map((b) => <SelectItem key={b.bundle} value={b.bundle}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">أنشئ المجموعات من شاشة «إدارة الصلاحيات».</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={create} disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء الموظف"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
