import { createFileRoute, useNavigate, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShoppingBasket, Phone, Lock } from "lucide-react";
import { auth } from "@/auth/store";
import { homeFor } from "@/auth/guards";
import { errorMessage } from "@/api/client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => { const s = await auth.ready(); if (s.status === "authed" && s.me && !s.me.user.force_password_change) throw redirect({ to: homeFor(s.me) }); },
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | وصل" },
      { name: "description", content: "سجّل الدخول إلى تطبيق وصل لطلب احتياجاتك من بقالة الحي أو إدارة متجرك." },
      { property: "og:title", content: "تسجيل الدخول | وصل" },
      { property: "og:description", content: "سجّل الدخول إلى تطبيق وصل لطلب احتياجاتك من بقالة الحي أو إدارة متجرك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    if (!phone.trim() || !password) { toast.error("أدخل رقم الجوال وكلمة المرور"); return; }
    setLoading(true);
    try {
      // the account-status gate (pending/rejected/suspended/deleted) is enforced by the API; it answers with a code
      const me = await auth.login(phone.trim(), password);
      if (me.user.force_password_change) { navigate({ to: "/change-password" }); return; }
      toast.success("تم تسجيل الدخول", { duration: 1500 });
      navigate({ to: homeFor(me) });
    } catch (e) {
      toast.error(errorMessage(e, "فشل تسجيل الدخول"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-accent/30 to-background">
      <Card className="w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-3">
            <ShoppingBasket className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">وصل</h1>
          <p className="text-sm text-muted-foreground mt-1">بقالة الحي في جوالك</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> رقم الجوال</Label>
            <Input
              inputMode="tel" dir="ltr" maxLength={9}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> كلمة المرور</Label>
            <PasswordInput
              dir="ltr" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button onClick={submit} disabled={loading} className="w-full h-12 text-base">
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </Button>
          <Button asChild variant="outline" className="w-full h-11">
            <Link to="/register">إنشاء حساب</Link>
          </Button>
          <div className="text-center">
            <Link to="/forgot-password" className="text-sm text-primary underline">نسيت كلمة المرور</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
