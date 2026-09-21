import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { User, Store as StoreIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/register/")({
  component: RegisterChoice,
  head: () => ({
    meta: [
      { title: "إنشاء حساب جديد | وصل" },
      { name: "description", content: "اختر نوع الحساب في وصل: مستهلك لطلب احتياجاتك، أو تاجر لعرض منتجات نشاطك." },
      { property: "og:title", content: "إنشاء حساب جديد | وصل" },
      { property: "og:description", content: "اختر نوع الحساب في وصل: مستهلك أو تاجر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function RegisterChoice() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-accent/30 to-background">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">إنشاء حساب جديد</h1>
          <p className="text-sm text-muted-foreground mt-1">اختر نوع الحساب المناسب لك</p>
        </div>

        <Link to="/register/customer">
          <Card className="p-5 flex items-center gap-4 hover:border-primary transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">مستهلك</p>
              <p className="text-xs text-muted-foreground">اطلب احتياجاتك من بقالات الحي</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-180" />
          </Card>
        </Link>

        <Link to="/register/merchant">
          <Card className="p-5 flex items-center gap-4 hover:border-primary transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <StoreIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold">تاجر</p>
              <p className="text-xs text-muted-foreground">اعرض منتجات نشاطك التجاري</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground rotate-180" />
          </Card>
        </Link>

        <div className="text-center pt-2">
          <Link to="/auth" className="text-sm text-primary underline">العودة لتسجيل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
