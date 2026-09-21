import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Wallet, Settings, Store, ScanBarcode, BarChart3, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import type { ReactNode } from "react";

const tabs = [
  { to: "/merchant", label: "اللوحة", icon: LayoutDashboard, exact: true },
  { to: "/merchant/pos", label: "بيع", icon: ScanBarcode },
  { to: "/merchant/orders", label: "الطلبات", icon: ShoppingBag },
  { to: "/merchant/products", label: "منتجات", icon: Package },
  { to: "/merchant/returns", label: "مرتجعات", icon: Undo2 },
  { to: "/merchant/reports", label: "تقارير", icon: BarChart3 },
  { to: "/merchant/credit", label: "الأجل", icon: Wallet },
  { to: "/merchant/settings", label: "المتجر", icon: Settings },
];

export function MerchantShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-accent/20 to-background">
      <header className="sticky top-0 z-30 bg-foreground text-background shadow">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Store className="w-6 h-6" />
          <div className="flex-1">
            <p className="text-[11px] opacity-70">لوحة التاجر</p>
            <h1 className="text-base font-bold leading-tight">{title}</h1>
          </div>
          {action}
          <NotificationBell />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/merchant/pos" })}
            className="text-background hover:bg-background/10"
            aria-label="نقطة البيع - مسح باركود"
          >
            <ScanBarcode className="w-5 h-5" />
          </Button>
        </div>
      </header>


      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t shadow-lg">
        <div className="max-w-3xl mx-auto grid grid-cols-8">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
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
