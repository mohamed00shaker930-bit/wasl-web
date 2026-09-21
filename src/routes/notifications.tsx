import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/auth/guards";
import { auth, useAuth } from "@/auth/store";
import { CustomerShell } from "@/components/CustomerShell";
import { MerchantShell } from "@/components/MerchantShell";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNotifications, markAllRead, markRead, type AppNotification } from "@/lib/notifications";
import { CheckCheck, ShoppingBag, Undo2, Wallet, Bell, UserRound } from "lucide-react";
import { formatTimeAgo } from "@/lib/dateFormat";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    const me = await requireAuth();
    // Admin users get the dedicated admin notifications center.
    if (auth.isAdmin(me)) throw redirect({ to: "/admin/notifications" });
  },
  component: NotificationsPage,
});

const ICONS: Record<string, any> = { order: ShoppingBag, return: Undo2, wallet: Wallet, info: Bell };

const fmt = (d: string) => formatTimeAgo(d);

function NotificationsPage() {
  const { data } = useNotifications();
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = data ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  // role + name/phone come from the session (/auth/me) instead of a profiles lookup
  const { me } = useAuth();
  const ctx = me ? { role: auth.role(me), name: me.user.name, phone: me.user.phone } : null;

  const open = async (n: AppNotification) => {
    if (!n.read_at) { await markRead(n.id); qc.invalidateQueries({ queryKey: ["notifications"] }); }
    if (n.link) nav({ to: n.link as any });
  };

  if (!ctx) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="inline-block w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const Shell = ctx.role === "merchant" ? MerchantShell : CustomerShell;

  return (
    <Shell title="الإشعارات">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <UserRound className="w-3.5 h-3.5" />
        <span>الحساب: {ctx.name?.trim() || "بدون اسم"}</span>
        {ctx.phone && <span dir="ltr">({ctx.phone})</span>}
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{unread > 0 ? `${unread} غير مقروء` : "لا جديد"}</p>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={async () => { await markAllRead(); qc.invalidateQueries({ queryKey: ["notifications"] }); }}>
            <CheckCheck className="w-4 h-4 ml-1" /> تعليم الكل
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <Card className="p-8 text-center text-muted-foreground">لا توجد إشعارات بعد</Card>}
        {list.map((n) => {
          const Icon = ICONS[n.type] || Bell;
          return (
            <Card key={n.id} onClick={() => open(n)}
              className={`p-3 flex gap-3 cursor-pointer transition ${!n.read_at ? "bg-primary/5 border-primary/30" : ""}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                <p className="text-[11px] text-muted-foreground mt-1">{fmt(n.created_at)}</p>
              </div>
              {!n.read_at && <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
            </Card>
          );
        })}
      </div>
    </Shell>
  );
}
