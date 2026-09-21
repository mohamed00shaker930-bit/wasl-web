import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { http, errorMessage } from "@/api/client";
import { auth } from "@/auth/store";

export const Route = createFileRoute("/change-password")({
  beforeLoad: async () => {
    const s = await auth.ready();
    if (s.status !== "authed") throw redirect({ to: "/auth" });
  },
  component: ChangePasswordPage,
  head: () => ({
    meta: [
      { title: "تغيير كلمة المرور | وصل" },
      { name: "description", content: "قم بتعيين كلمة مرور جديدة لحسابك في تطبيق وصل." },
      { property: "og:title", content: "تغيير كلمة المرور | وصل" },
      { property: "og:description", content: "قم بتعيين كلمة مرور جديدة لحسابك في تطبيق وصل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const forced = auth.state.me?.user.force_password_change ?? false;
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (password.length < 6 || password.length > 72) e.password = "كلمة المرور 6 أحرف على الأقل.";
    if (!forced && !current) e.current = "أدخل كلمة المرور الحالية";
    if (confirm !== password) e.confirm = "كلمتا المرور غير متطابقتين";
    return e;
  }, [password, confirm]);
  const valid = Object.keys(errors).length === 0;

  const submit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    try {
      await http.post("/auth/change-password", forced ? { new_password: password } : { current_password: current, new_password: password });
      await auth.logout();
      toast.success("تم تغيير كلمة المرور بنجاح، سجّل الدخول بكلمة المرور الجديدة.");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(errorMessage(e, "تعذر تغيير كلمة المرور"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-accent/30 to-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="text-center">
          <Lock className="w-10 h-10 mx-auto text-primary mb-2" />
          <h1 className="text-xl font-bold">تغيير كلمة المرور</h1>
        </div>
        {!forced && (
          <div className="space-y-2">
            <Label>كلمة المرور الحالية</Label>
            <PasswordInput dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
        )}
        <div className="space-y-2">
          <Label>كلمة المرور الجديدة</Label>
          <PasswordInput dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <div className="space-y-2">
          <Label>تأكيد كلمة المرور</Label>
          <PasswordInput dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm && errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
        </div>
        <Button onClick={submit} disabled={!valid || loading} className="w-full h-12 text-base">
          {loading ? "جاري الحفظ..." : "تأكيد"}
        </Button>
      </Card>
    </div>
  );
}
