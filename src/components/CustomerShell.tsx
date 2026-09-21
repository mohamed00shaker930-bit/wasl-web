import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingCart, ClipboardList, Wallet, User, ShoppingBasket } from "lucide-react";
import { useCart } from "@/lib/cart";
import { NotificationBell } from "@/components/NotificationBell";
import { CustomerScanButton } from "@/components/CustomerScanButton";
import type { ReactNode } from "react";

const tabs = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/cart", label: "السلة", icon: ShoppingCart },
  { to: "/orders", label: "طلباتي", icon: ClipboardList },
  { to: "/credit", label: "الأجل", icon: Wallet },
  { to: "/profile", label: "حسابي", icon: User },
];

export function CustomerShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();

  return (
    <div className="min-h-screen pb-20 bg-gradient-to-b from-accent/20 to-background">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <ShoppingBasket className="w-6 h-6" />
          <h1 className="text-lg font-bold flex-1">{title}</h1>
          {action}
          <NotificationBell />
          <CustomerScanButton />
        </div>
      </header>


      <main className="max-w-2xl mx-auto px-4 py-4">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t shadow-lg">
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = path === t.to || (t.to !== "/home" && path.startsWith(t.to));
            const showBadge = t.to === "/cart" && cart.items.length > 0;
            return (
              <Link key={t.to} to={t.to} className={`flex flex-col items-center gap-1 py-2 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {showBadge && (
                    <span className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold">
                      {cart.items.reduce((s, i) => s + i.qty, 0)}
                    </span>
                  )}
                </div>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
