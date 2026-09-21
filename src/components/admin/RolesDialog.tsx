import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuditLogList } from "@/components/admin/AuditLogList";
import { LoginSessionsList } from "@/components/admin/LoginSessionsList";
import { AppUsageList } from "@/components/admin/AppUsageList";
import { http, errorMessage } from "@/api/client";
import { getPermissionCatalog, hasPerm, type AdminUserDetail, type PermCatalog, type PermDef } from "@/api/admin";
import { useAuth } from "@/auth/store";
import { toast } from "sonner";

export const STAFF_ROLES = [
  { key: "super_admin", label: "مدير رئيسي" },
  { key: "admin", label: "مدير" },
  { key: "operations", label: "عمليات" },
  { key: "support", label: "خدمة عملاء" },
  { key: "finance", label: "مالية" },
] as const;

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(STAFF_ROLES.map((r) => [r.key, r.label]));

export type RolesDialogUser = {
  user_id: string;
  name: string | null;
  phone: string | null;
  roles: string[] | null;
};

const DURATIONS = [
  { key: "1d", label: "يوم واحد", days: 1 },
  { key: "3d", label: "٣ أيام", days: 3 },
  { key: "7d", label: "أسبوع", days: 7 },
  { key: "30d", label: "شهر", days: 30 },
  { key: "custom", label: "تاريخ مخصّص", days: 0 },
  { key: "permanent", label: "دائم (حظر)", days: 0 },
] as const;

function untilFromKey(key: string, customUntil: string): string | null {
  if (key === "permanent") return null;
  if (key === "custom") return customUntil ? new Date(customUntil).toISOString() : null;
  const d = DURATIONS.find((x) => x.key === key)?.days ?? 1;
  return new Date(Date.now() + d * 86400000).toISOString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

const STAFF_ROLE_KEYS = ["admin", "operations", "support", "finance"];

export function RolesDialog({ user, onClose, onChanged }: { user: RolesDialogUser | null; onClose: () => void; onChanged: () => void }) {
  const { me } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<PermCatalog | null>(null);
  const [targetPerms, setTargetPerms] = useState<Set<string>>(new Set());
  const [newBundleLabel, setNewBundleLabel] = useState("");

  const [suspendReason, setSuspendReason] = useState("");
  const [durationKey, setDurationKey] = useState<string>("7d");
  const [customUntil, setCustomUntil] = useState("");
  const [amount, setAmount] = useState("");
  const [perkNote, setPerkNote] = useState("");
  const [pName, setPName] = useState("");
  const [pCity, setPCity] = useState("");
  const [pDistrict, setPDistrict] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pBusiness, setPBusiness] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [commission, setCommission] = useState("");

  const loadPermMgmt = useCallback(async (uid: string) => {
    const [c, tp] = await Promise.allSettled([getPermissionCatalog(), http.get<string[]>(`/admin/permissions/users/${uid}`)]);
    if (c.status === "fulfilled") setCatalog(c.value);
    if (tp.status === "fulfilled") setTargetPerms(new Set(tp.value || []));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let d: AdminUserDetail;
    try {
      d = await http.get<AdminUserDetail>(`/admin/users/${user.user_id}`);
    } catch (e) {
      setLoading(false);
      toast.error(errorMessage(e, "تعذّر جلب تفاصيل المستخدم"));
      return;
    }
    setLoading(false);
    setDetail(d);
    const p = d.profile;
    setPName(p.name || ""); setPCity(p.city || ""); setPDistrict(p.district || "");
    setPAddress(p.address || ""); setPBusiness(p.businessName || "");
    const store = d.stores?.[0];
    setCommission(store?.commissionPct != null ? String(Number(store.commissionPct)) : "");
    const roles = d.roles || [];
    const isSuperT = roles.includes("super_admin");
    const isStaffT = isSuperT || roles.some((r) => STAFF_ROLE_KEYS.includes(r));
    if (isStaffT && !isSuperT && me?.super) await loadPermMgmt(user.user_id);
  }, [user, loadPermMgmt, me?.super]);

  useEffect(() => { setDetail(null); setCatalog(null); setTargetPerms(new Set()); if (user) load(); }, [user, load]);

  if (!user) return null;

  const profile = detail?.profile;
  const store = detail?.stores?.[0] ?? null;
  const roles = detail?.roles || [];
  const isSuperTarget = roles.includes("super_admin");
  const isStaffTarget = isSuperTarget || roles.some((r) => STAFF_ROLE_KEYS.includes(r));
  const isEndUser = !!detail && !isStaffTarget;
  const isMerchant = profile?.userType === "merchant" || roles.includes("merchant");
  const can = (p: string) => hasPerm(me, p);

  const effectiveSuspended =
    profile?.accountStatus === "suspended" && (!profile?.suspendedUntil || new Date(profile.suspendedUntil) > new Date());

  const statusBadge = () => {
    if (!profile) return null;
    if (isStaffTarget) return <Badge className="bg-indigo-600 hover:bg-indigo-600">{isSuperTarget ? "مدير رئيسي" : "مدير"}</Badge>;
    if (effectiveSuspended) {
      if (!profile.suspendedUntil) return <Badge variant="destructive">محظور</Badge>;
      return <Badge className="bg-amber-500 hover:bg-amber-500">معلّق حتى {fmtDate(profile.suspendedUntil)}</Badge>;
    }
    if (profile.accountStatus === "active") return <Badge className="bg-emerald-600 hover:bg-emerald-600">نشط</Badge>;
    return <Badge variant="secondary">{profile.accountStatus}</Badge>;
  };

  const run = async (key: string, call: () => Promise<unknown>, okMsg: string, after?: () => void) => {
    setBusy(key);
    try {
      await call();
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "حدث خطأ"));
      return;
    }
    setBusy(null);
    toast.success(okMsg); after?.(); await load(); onChanged();
  };

  const togglePerm = async (perm: string, next: boolean) => {
    setBusy("perm-" + perm);
    try {
      await http.post("/admin/permissions/grant", { user_id: user.user_id, perm, grant: next });
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر التحديث"));
      return;
    }
    setBusy(null);
    const s = new Set(targetPerms); if (next) s.add(perm); else s.delete(perm); setTargetPerms(s);
    toast.success("تم التحديث"); onChanged();
  };
  const applyBundle = async (bundle: string) => {
    setBusy("bundle-" + bundle);
    try {
      await http.post(`/admin/permissions/bundles/${bundle}/apply`, { user_id: user.user_id });
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر التطبيق"));
      return;
    }
    setBusy(null);
    toast.success("تم تطبيق المجموعة"); await loadPermMgmt(user.user_id); onChanged();
  };
  const deleteBundle = async (bundle: string) => {
    setBusy("delbundle-" + bundle);
    try {
      await http.del(`/admin/permissions/bundles/${bundle}`);
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر الحذف"));
      return;
    }
    setBusy(null);
    toast.success("تم حذف المجموعة"); await loadPermMgmt(user.user_id);
  };
  const createBundle = async () => {
    if (!newBundleLabel.trim()) { toast.error("اسم المجموعة مطلوب"); return; }
    if (targetPerms.size === 0) { toast.error("حدّد صلاحية واحدة على الأقل أولًا"); return; }
    const key = "b_" + Math.random().toString(36).slice(2, 10);
    setBusy("createbundle");
    try {
      await http.put(`/admin/permissions/bundles/${key}`, { label: newBundleLabel.trim(), perms: Array.from(targetPerms) });
    } catch (e) {
      setBusy(null);
      toast.error(errorMessage(e, "تعذّر الإنشاء"));
      return;
    }
    setBusy(null);
    toast.success("تم إنشاء المجموعة"); setNewBundleLabel(""); await loadPermMgmt(user.user_id);
  };
  const revokeAdminTier = () =>
    run("demote", () => http.post(`/admin/users/${user.user_id}/role`, { role: "admin", grant: false }), "تم إلغاء رتبة المدير");

  const doSuspend = () => {
    if (!suspendReason.trim()) { toast.error("سبب التعليق مطلوب"); return; }
    const until = untilFromKey(durationKey, customUntil);
    if (durationKey === "custom" && !until) { toast.error("اختر تاريخًا صحيحًا"); return; }
    run("suspend", () => http.post(`/admin/users/${user.user_id}/status`, { status: "suspended", reason: suspendReason.trim(), ...(until ? { until } : {}) }), "تم تعليق الحساب", () => setSuspendReason(""));
  };
  const doReactivate = () => run("reactivate", () => http.post(`/admin/users/${user.user_id}/status`, { status: "active" }), "تمت إعادة التفعيل");
  const doGrant = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    run("grant", () => http.post(`/admin/users/${user.user_id}/wallet-grant`, { amount: amt, ...(perkNote.trim() ? { note: perkNote.trim() } : {}) }), "تم إضافة الرصيد", () => { setAmount(""); setPerkNote(""); });
  };
  const doSaveProfile = () =>
    run("profile", () => http.patch(`/admin/users/${user.user_id}/profile`, {
      ...(pName.trim() ? { name: pName.trim() } : {}), city: pCity || null, district: pDistrict || null, address: pAddress || null,
      ...(isMerchant ? { business_name: pBusiness || null } : {}),
    }), "تم حفظ البيانات");
  const doSendNotif = () => {
    if (!nTitle.trim() || !nBody.trim()) { toast.error("العنوان والنص مطلوبان"); return; }
    run("notif", () => http.post("/admin/notifications/send", { user_id: user.user_id, title: nTitle.trim(), body: nBody.trim(), type: "admin" }), "تم إرسال الإشعار", () => { setNTitle(""); setNBody(""); });
  };
  const doStoreStatus = (next: string) => {
    if (!store) return;
    run("store-status", () => http.post(`/admin/stores/${store.id}/status`, { status: next }), next === "suspended" ? "تم تعليق المتجر" : "تم تفعيل المتجر");
  };
  const doStoreCommission = () => {
    if (!store) return;
    const pct = Number(commission);
    if (isNaN(pct) || pct < 0 || pct > 100) { toast.error("أدخل نسبة صحيحة"); return; }
    run("store-commission", () => http.post(`/admin/stores/${store.id}/commission`, { commission_pct: pct }), "تم حفظ العمولة");
  };

  const showAccount = can("users.suspend") || can("users.wallet_grant") || can("users.edit");
  const endTabs = [
    ...(showAccount ? [{ v: "account", l: "الحساب" }] : []),
    ...(isMerchant && can("stores.manage") ? [{ v: "store", l: "المتجر" }] : []),
    ...(can("users.notify") ? [{ v: "comm", l: "التواصل" }] : []),
    ...(can("oversight.view") ? [{ v: "activity", l: "النشاط" }, { v: "sessions", l: "الجلسات" }, { v: "usage", l: "الاستخدام" }] : []),
  ];

  const groups: { key: string; label: string; items: PermDef[] }[] = [];
  (catalog?.defs || []).forEach((d) => {
    let g = groups.find((x) => x.key === d.grp);
    if (!g) { g = { key: d.grp, label: d.grpLabel, items: [] }; groups.push(g); }
    g.items.push(d);
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل المستخدم</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <span>{profile?.name || user.name || "—"} • {profile?.phone || user.phone || "—"}</span>
            {statusBadge()}
          </DialogDescription>
        </DialogHeader>

        {loading && !detail ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
        ) : isStaffTarget ? (
          !me?.super ? (
            <p className="py-8 text-center text-sm text-muted-foreground">إدارة صلاحيات فريق الإدارة متاحة للمدير الرئيسي فقط.</p>
          ) : isSuperTarget ? (
            <div className="py-8 text-center space-y-1">
              <Badge className="bg-indigo-600 hover:bg-indigo-600">مدير رئيسي</Badge>
              <p className="text-sm text-muted-foreground">هذا مدير رئيسي — يملك جميع الصلاحيات ولا يخضع للإدارة.</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="border rounded-lg p-3 space-y-2">
                <span className="text-sm font-medium">حِزم جاهزة</span>
                <div className="flex flex-wrap gap-2">
                  {(catalog?.bundles || []).map((b) => (
                    <span key={b.bundle} className="inline-flex items-center rounded-md border overflow-hidden">
                      <button className="px-2 py-1 text-xs hover:bg-accent disabled:opacity-50" disabled={busy === "bundle-" + b.bundle} onClick={() => applyBundle(b.bundle)}>
                        + {b.label}
                      </button>
                      <button className="px-1.5 py-1 text-xs text-destructive border-r hover:bg-accent disabled:opacity-50" title="حذف المجموعة" disabled={busy === "delbundle-" + b.bundle} onClick={() => deleteBundle(b.bundle)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Input className="h-8 text-xs" placeholder="اسم مجموعة جديدة (من الصلاحيات المحددة)" value={newBundleLabel} onChange={(e) => setNewBundleLabel(e.target.value)} />
                  <Button size="sm" variant="outline" disabled={busy === "createbundle"} onClick={createBundle}>حفظ</Button>
                </div>
              </div>

              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.key} className="border rounded-lg p-3 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">{g.label}</span>
                    {g.items.map((d) => (
                      <div key={d.perm} className="flex items-center justify-between gap-2">
                        <Label htmlFor={"perm-" + d.perm} className="text-sm flex items-center gap-2">
                          {d.label}
                          {d.superOnly && <span className="text-[10px] text-muted-foreground">(للرئيسي فقط)</span>}
                        </Label>
                        <Switch
                          id={"perm-" + d.perm}
                          checked={d.superOnly ? false : targetPerms.has(d.perm)}
                          disabled={d.superOnly || busy === "perm-" + d.perm}
                          onCheckedChange={(v) => togglePerm(d.perm, v)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <Button size="sm" variant="outline" className="text-destructive" disabled={busy === "demote"} onClick={revokeAdminTier}>
                إلغاء رتبة المدير
              </Button>
            </div>
          )
        ) : isEndUser ? (
          endTabs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا تملك صلاحيات على هذا الحساب.</p>
          ) : (
            <Tabs defaultValue={endTabs[0].v} className="mt-2">
              <TabsList className="flex w-full flex-wrap h-auto gap-1">
                {endTabs.map((t) => <TabsTrigger key={t.v} value={t.v} className="text-xs">{t.l}</TabsTrigger>)}
              </TabsList>

              {showAccount && (
                <TabsContent value="account" className="space-y-4 py-2">
                  {can("users.suspend") && (
                    <div className="border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">حالة الحساب</span>
                        {statusBadge()}
                      </div>
                      {profile?.statusReason && <p className="text-xs text-muted-foreground">السبب: {profile.statusReason}</p>}
                      {effectiveSuspended ? (
                        <Button size="sm" variant="outline" disabled={busy === "reactivate"} onClick={doReactivate}>إعادة تفعيل الحساب</Button>
                      ) : (
                        <div className="space-y-2">
                          <Label className="text-xs">مدّة التعليق</Label>
                          <Select value={durationKey} onValueChange={setDurationKey}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{DURATIONS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
                          </Select>
                          {durationKey === "custom" && <Input type="datetime-local" value={customUntil} onChange={(e) => setCustomUntil(e.target.value)} />}
                          <Input placeholder="سبب التعليق (إلزامي)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
                          <Button size="sm" variant="destructive" disabled={busy === "suspend"} onClick={doSuspend}>
                            {durationKey === "permanent" ? "حظر الحساب" : "تطبيق التعليق"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {can("users.wallet_grant") && (
                    <div className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">المميزات — رصيد المحفظة</span>
                        <span className="text-sm font-semibold">{Number(detail?.wallet?.balance ?? 0).toLocaleString()}</span>
                      </div>
                      <Input type="number" inputMode="decimal" placeholder="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      <Input placeholder="ملاحظة (اختياري)" value={perkNote} onChange={(e) => setPerkNote(e.target.value)} />
                      <Button size="sm" disabled={busy === "grant"} onClick={doGrant}>إضافة رصيد</Button>
                    </div>
                  )}

                  {can("users.edit") && (
                    <div className="border rounded-lg p-3 space-y-2">
                      <span className="text-sm font-medium">البيانات الشخصية</span>
                      <div className="space-y-1"><Label className="text-xs">الاسم</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
                      {isMerchant && <div className="space-y-1"><Label className="text-xs">اسم النشاط</Label><Input value={pBusiness} onChange={(e) => setPBusiness(e.target.value)} /></div>}
                      <div className="space-y-1"><Label className="text-xs">المدينة</Label><Input value={pCity} onChange={(e) => setPCity(e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">المديرية</Label><Input value={pDistrict} onChange={(e) => setPDistrict(e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs">العنوان</Label><Input value={pAddress} onChange={(e) => setPAddress(e.target.value)} /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">رقم الجوال</Label>
                        <Input value={profile?.phone || ""} disabled readOnly />
                        <p className="text-[11px] text-muted-foreground">تعديل الرقم يتطلب طبقة المصادقة — قريبًا.</p>
                      </div>
                      <Button size="sm" disabled={busy === "profile"} onClick={doSaveProfile}>حفظ البيانات</Button>
                    </div>
                  )}
                </TabsContent>
              )}

              {isMerchant && can("stores.manage") && (
                <TabsContent value="store" className="space-y-3 py-2">
                  {store ? (
                    <>
                      <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{store.name || "المتجر"}</span>
                          <Badge variant={store.status === "active" ? "default" : "secondary"}>
                            {store.status === "active" ? "مفعّل" : store.status === "suspended" ? "معلّق" : store.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">الحالة التشغيلية: {store.isOpen ? "مفتوح" : "مغلق"}</p>
                        {store.status === "active" ? (
                          <Button size="sm" variant="destructive" disabled={busy === "store-status"} onClick={() => doStoreStatus("suspended")}>تعليق المتجر</Button>
                        ) : (
                          <Button size="sm" disabled={busy === "store-status"} onClick={() => doStoreStatus("active")}>تفعيل المتجر</Button>
                        )}
                      </div>
                      <div className="border rounded-lg p-3 space-y-2">
                        <Label className="text-xs">نسبة العمولة (%)</Label>
                        <Input type="number" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
                        <Button size="sm" disabled={busy === "store-commission"} onClick={doStoreCommission}>حفظ العمولة</Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">لا يوجد متجر مرتبط بهذا التاجر.</p>
                  )}
                </TabsContent>
              )}

              {can("users.notify") && (
                <TabsContent value="comm" className="space-y-2 py-2">
                  <div className="border rounded-lg p-3 space-y-2">
                    <span className="text-sm font-medium">إرسال إشعار للمستخدم</span>
                    <Input placeholder="العنوان" value={nTitle} onChange={(e) => setNTitle(e.target.value)} />
                    <Textarea placeholder="نص الإشعار" value={nBody} onChange={(e) => setNBody(e.target.value)} rows={3} />
                    <Button size="sm" disabled={busy === "notif"} onClick={doSendNotif}>إرسال الإشعار</Button>
                  </div>
                </TabsContent>
              )}

              {can("oversight.view") && (
                <>
                  <TabsContent value="activity" className="py-2"><AuditLogList filter={{ userId: user.user_id }} pageSize={20} /></TabsContent>
                  <TabsContent value="sessions" className="py-2"><LoginSessionsList userId={user.user_id} pageSize={20} /></TabsContent>
                  <TabsContent value="usage" className="py-2"><AppUsageList userId={user.user_id} pageSize={20} /></TabsContent>
                </>
              )}
            </Tabs>
          )
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
