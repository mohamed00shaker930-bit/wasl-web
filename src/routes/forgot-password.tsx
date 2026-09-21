import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, KeyRound } from "lucide-react";
import { http } from "@/api/client";
import { isValidYemeniPhone } from "@/lib/auth";


export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "نسيت كلمة المرور | وصل" },
      { name: "description", content: "أرسل طلب إعادة تعيين كلمة المرور لحسابك في وصل وستتواصل معك الإدارة." },
      { property: "og:title", content: "نسيت كلمة المرور | وصل" },
      { property: "og:description", content: "أرسل طلب إعادة تعيين كلمة المرور لحسابك في وصل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const phoneError = phone.trim() && !isValidYemeniPhone(phone.trim()) ? "الرقم غير صحيح." : "";

  const submit = async () => {
    if (loading || !phone.trim() || phoneError) return;
    setLoading(true);
    try {
      await http.post("/auth/password-reset-requests", { phone: phone.trim(), reason: reason.trim() || undefined });
    } catch {
      /* لا نكشف أي تفاصيل */
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-accent/30 to-background">
        <Card className="w-full max-w-md p-6 space-y-5 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-primary" />
          <p className="font-bold">تم إرسال الطلب. ستتواصل معك الإدارة.</p>
          <Button asChild className="w-full h-12"><Link to="/auth">العودة لتسجيل الدخول</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-accent/30 to-background">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="text-center">
          <KeyRound className="w-10 h-10 mx-auto text-primary mb-2" />
          <h1 className="text-xl font-bold">نسيت كلمة المرور</h1>
        </div>
        <div className="space-y-2">
          <Label>رقم الجوال</Label>
          <Input inputMode="tel" dir="ltr" maxLength={9} placeholder="7XXXXXXXX" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
          {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
        </div>
        <div className="space-y-2">
          <Label>سبب الطلب (اختياري)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <Button onClick={submit} disabled={loading || !phone.trim() || !!phoneError} className="w-full h-12 text-base">
          {loading ? "جاري الإرسال..." : "إرسال"}
        </Button>
        <div className="text-center">
          <Link to="/auth" className="text-sm text-primary underline">العودة لتسجيل الدخول</Link>
        </div>
      </Card>
    </div>
  );
}
