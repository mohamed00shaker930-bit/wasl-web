import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { http, errorMessage } from "@/api/client";
import { requireAuth } from "@/auth/guards";
import { auth } from "@/auth/store";
import { CustomerShell } from "@/components/CustomerShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Phone, MessageCircle, Lock, Clock, EyeOff, Timer, Languages, Wallet, MapPin, Heart, KeyRound, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  isPinSet, isLockEnabled, setLockEnabled, setPin, clearPin, PIN_LENGTH, verifyPin,
  LOCK_DURATIONS, getLockDuration, setLockDuration,
  isIdleLockEnabled, setIdleLockEnabled,
  isHideLockEnabled, setHideLockEnabled,
} from "@/lib/app-lock";
import { useLang, setLang } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => requireAuth(),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  // own profile row (camelCase); the page only reads name/phone. Edits would go through PATCH /me/profile.
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => http.get<{ id: string; name: string | null; phone: string }>("/me/profile"),
  });

  const [enabled, setEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [openSet, setOpenSet] = useState(false);
  const [openRemove, setOpenRemove] = useState(false);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [removePin, setRemovePin] = useState("");
  const [duration, setDuration] = useState<number>(10);
  const [idleOn, setIdleOn] = useState(true);
  const [hideOn, setHideOn] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setHasPin(isPinSet());
    setEnabled(isLockEnabled());
    setDuration(getLockDuration());
    setIdleOn(isIdleLockEnabled());
    setHideOn(isHideLockEnabled());
  }, []);

  const signOut = async () => {
    await auth.logout();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth", replace: true });
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await http.del("/me");
      await auth.logout();
      toast.success("تم حذف حسابك");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(errorMessage(e, "تعذّر حذف الحساب"));
    } finally {
      setDeleting(false);
    }
  };

  const toggleLock = (v: boolean) => {
    if (v && !isPinSet()) { setOpenSet(true); return; }
    setLockEnabled(v);
    setEnabled(v);
    toast.success(v ? "تم تفعيل القفل" : "تم إيقاف القفل", { duration: 2000 });
  };

  const savePin = async () => {
    if (pin1.length !== PIN_LENGTH || pin2.length !== PIN_LENGTH) { toast.error(`الرمز ${PIN_LENGTH} أرقام`); return; }
    if (pin1 !== pin2) { toast.error("الرمزان غير متطابقين"); return; }
    await setPin(pin1);
    setHasPin(true); setEnabled(true);
    setOpenSet(false); setPin1(""); setPin2("");
    toast.success("تم حفظ الرمز", { duration: 2000 });
  };

  const removeLock = async () => {
    if (!(await verifyPin(removePin))) { toast.error("الرمز خاطئ"); return; }
    clearPin();
    setHasPin(false); setEnabled(false);
    setOpenRemove(false); setRemovePin("");
    toast.success("تم حذف الرمز", { duration: 2000 });
  };

  const onDurationChange = (val: string) => {
    const n = Number(val);
    setDuration(n);
    setLockDuration(n);
    toast.success("تم تحديث مدة القفل", { duration: 1800 });
  };
  const onIdleChange = (v: boolean) => { setIdleOn(v); setIdleLockEnabled(v); };
  const onHideChange = (v: boolean) => { setHideOn(v); setHideLockEnabled(v); };

  return (
    <CustomerShell title="حسابي">
      <Card className="p-6 text-center mb-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center text-3xl font-bold mb-3">
          {profile?.name?.[0] || "؟"}
        </div>
        <h2 className="font-bold text-lg">{profile?.name || "بدون اسم"}</h2>
        <p className="text-sm text-muted-foreground" dir="ltr">{profile?.phone}</p>
      </Card>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Link to="/wallet"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><Wallet className="w-5 h-5 text-primary" /><span className="text-xs font-medium">المحفظة</span></Card></Link>
        <Link to="/favorites"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><Heart className="w-5 h-5 text-destructive" /><span className="text-xs font-medium">المفضلة</span></Card></Link>
        <Link to="/locations"><Card className="p-3 flex flex-col items-center gap-1 hover:border-primary"><MapPin className="w-5 h-5 text-primary" /><span className="text-xs font-medium">مواقعي</span></Card></Link>
      </div>

      <Card className="p-4 mb-4">
        <h3 className="font-bold flex items-center gap-2 mb-3"><Languages className="w-4 h-4 text-primary" /> اللغة / Language</h3>
        <LanguageSwitcher />
      </Card>

      <Card className="p-4 mb-4">
        <h3 className="font-bold flex items-center gap-2 mb-3"><KeyRound className="w-4 h-4 text-primary" /> كلمة المرور</h3>
        <Button asChild variant="outline" className="w-full">
          <Link to="/change-password">تغيير كلمة المرور</Link>
        </Button>
      </Card>

      <Card className="p-4 mb-4 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> قفل التطبيق</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">تفعيل قفل التطبيق برمز</p>
            <p className="text-xs text-muted-foreground">رمز من {PIN_LENGTH} أرقام</p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleLock} />
        </div>

        {enabled && hasPin && (
          <>
            <div className="pt-3 border-t space-y-3">
              <div className="space-y-1">
                <label className="text-sm flex items-center gap-2"><Timer className="w-4 h-4 text-primary" /> اطلب الرمز</label>
                <Select value={String(duration)} onValueChange={onDurationChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCK_DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">المدة التي يبقى بعدها التطبيق مفتوحاً قبل طلب الرمز.</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> القفل عند الخمول</p>
                  <p className="text-xs text-muted-foreground">قفل التطبيق تلقائياً عند عدم الاستخدام</p>
                </div>
                <Switch checked={idleOn} onCheckedChange={onIdleChange} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm flex items-center gap-2"><EyeOff className="w-4 h-4 text-muted-foreground" /> القفل عند إخفاء التطبيق</p>
                  <p className="text-xs text-muted-foreground">قفل التطبيق عند الخروج منه أو تبديله</p>
                </div>
                <Switch checked={hideOn} onCheckedChange={onHideChange} />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpenSet(true)}>تغيير الرمز</Button>
              <Button size="sm" variant="ghost" className="flex-1 text-destructive" onClick={() => setOpenRemove(true)}>حذف الرمز</Button>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-bold mb-2">المساعدة</h3>
        <a href="tel:+967700000000" className="flex items-center gap-3 p-2 rounded hover:bg-accent">
          <Phone className="w-5 h-5 text-primary" /> اتصل بنا
        </a>
        <a href="https://wa.me/967700000000" target="_blank" className="flex items-center gap-3 p-2 rounded hover:bg-accent">
          <MessageCircle className="w-5 h-5 text-success" /> واتساب
        </a>
      </Card>

      <Card className="p-4 mt-4 space-y-2">
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
        </Button>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-4 h-4 ml-2" /> حذف الحساب
        </Button>
      </Card>

      <Dialog open={openSet} onOpenChange={(v) => { setOpenSet(v); if (!v) { setPin1(""); setPin2(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>إنشاء رمز القفل</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">أدخل {PIN_LENGTH} أرقام</p>
          <div dir="ltr" className="flex justify-center">
            <InputOTP maxLength={PIN_LENGTH} value={pin1} onChange={setPin1}>
              <InputOTPGroup>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-muted-foreground">أعد كتابة الرمز للتأكيد</p>
          <div dir="ltr" className="flex justify-center">
            <InputOTP maxLength={PIN_LENGTH} value={pin2} onChange={setPin2}>
              <InputOTPGroup>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={savePin}>حفظ</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={openRemove} onOpenChange={(v) => { setOpenRemove(v); if (!v) setRemovePin(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>حذف رمز القفل</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">أدخل الرمز الحالي للتأكيد</p>
          <div dir="ltr" className="flex justify-center">
            <InputOTP maxLength={PIN_LENGTH} value={removePin} onChange={setRemovePin}>
              <InputOTPGroup>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button variant="destructive" onClick={removeLock}>حذف</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              لن تتمكن من الدخول بعد حذف حسابك، وتحتفظ الإدارة بسجلّ بذلك. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteAccount}>
              نعم، احذف حسابي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomerShell>
  );
}

function LanguageSwitcher() {
  const lang = useLang();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant={lang === "ar" ? "default" : "outline"} onClick={() => { setLang("ar"); toast.success("تم تغيير اللغة"); }}>العربية</Button>
      <Button variant={lang === "en" ? "default" : "outline"} onClick={() => { setLang("en"); toast.success("Language changed"); }}>English</Button>
    </div>
  );
}
