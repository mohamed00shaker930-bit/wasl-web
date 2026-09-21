import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, Store, ShoppingBag, Wallet, Megaphone, Image as ImageIcon, Settings, LogOut, ShieldCheck, BarChart3, Library, History, UserPlus, KeyRound, Tags, Lock } from "lucide-react";
import { auth, useAuth } from "@/auth/store";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { toast } from "sonner";
import { useMemo } from "react";
import type { ReactNode } from "react";

const allTabs = [
  { to: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { to: "/admin/kpis", label: "المؤشرات", icon: BarChart3 },
  { to: "/admin/library", label: "المكتبة", icon: Library },
  { to: "/admin/analytics", label: "تحليلات", icon: BarChart3 },
  { to: "/admin/merchants", label: "المتاجر", icon: Store },
  { to: "/admin/account-requests", label: "طلبات الحسابات", icon: UserPlus },
  { to: "/admin/password-resets", label: "كلمات المرور", icon: KeyRound },
  { to: "/admin/business-types", label: "أنواع الأنشطة", icon: Tags },
  { to: "/admin/users", label: "المستخدمون", icon: Users },
  { to: "/admin/team", label: "فريق الإدارة", icon: ShieldCheck, superOnly: true },
  { to: "/admin/permissions", label: "إدارة الصلاحيات", icon: Lock, superOnly: true },
  { to: "/admin/orders", label: "الطلبات", icon: ShoppingBag },
  { to: "/admin/wallets", label: "المحافظ", icon: Wallet },
  { to: "/admin/broadcast", label: "إشعارات", icon: Megaphone },
  { to: "/admin/banners", label: "بانرات", icon: ImageIcon },
  { to: "/admin/audit", label: "سجل العمليات", icon: History },
  { to: "/admin/settings", label: "إعدادات", icon: Settings },
];

export function AdminShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { me } = useAuth();

  const tabs = useMemo(() => allTabs.filter((t) => !t.superOnly || !!me?.super), [me]);

  const signOut = async () => {
    await auth.logout();
    toast.success("تم تسجيل الخروج");
    navigate({ to: "/auth" });
  };
  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-primary/5 to-background">
      <header className="sticky top-0 z-30 bg-foreground text-background shadow">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" />
          <div className="flex-1">
            <p className="text-[11px] opacity-70">لوحة الإدارة</p>
            <h1 className="text-base font-bold leading-tight">{title}</h1>
          </div>
          {action}
          <NotificationBell />
          <Button size="sm" variant="ghost" onClick={signOut} className="text-background hover:bg-background/10">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t shadow-lg">
        <div className="max-w-5xl mx-auto flex overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] shrink-0 min-w-[64px] flex-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
