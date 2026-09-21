import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { http } from "@/api/client";
import type { Paged } from "@/api/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { formatDateTimeFull, formatTimeAgo } from "@/lib/dateFormat";

export type LoginSession = {
  id: string;
  userId: string | null;
  userName: string | null;
  userPhone: string | null;
  loginAt: string;
  logoutAt: string | null;
  lastSeenAt: string | null;
  logoutType: "signout" | "expired" | string | null;
  ip: string | null;
  userAgent: string | null;
  isActive: boolean;
};

export function deviceLabel(ua: string | null): string {
  if (!ua) return "متصفح";
  if (/Android/i.test(ua)) return "جوال أندرويد";
  if (/iPhone|iPad|iPod/i.test(ua)) return "آيفون";
  return "متصفح";
}

export function LoginSessionsList({
  userId = null,
  status = null,
  pageSize = 20,
  showUser = false,
  onTotal,
}: {
  userId?: string | null;
  status?: "active" | "ended" | null;
  pageSize?: number;
  showUser?: boolean;
  onTotal?: (n: number) => void;
}) {
  const [rows, setRows] = useState<LoginSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPage(0); }, [userId, status, pageSize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await http.get<Paged<LoginSession>>("/admin/login-sessions", {
          user_id: userId ?? undefined,
          // the API's filter values are active|closed
          status: status === "ended" ? "closed" : status ?? undefined,
          limit: pageSize,
          offset: page * pageSize,
        });
        if (cancelled) return;
        setRows(r.items);
        setTotal(r.total); onTotal?.(r.total);
      } catch {
        if (cancelled) return;
        setRows([]); setTotal(0); onTotal?.(0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, status, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading && rows.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</p>;
  }
  if (!loading && rows.length === 0) {
    return <p className="text-center text-muted-foreground py-8 text-sm">لا توجد تسجيلات دخول</p>;
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const device = deviceLabel(r.userAgent);
        return (
          <Card key={r.id} className="p-3">
            {showUser && (
              <div className="flex items-center gap-2 flex-wrap mb-2 pb-2 border-b">
                {r.userId ? (
                  <Link
                    to="/admin/user-file/$userId"
                    params={{ userId: r.userId }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{r.userName || "غير معروف"}</span>
                    {r.userPhone && <span className="text-xs text-muted-foreground font-normal">{r.userPhone}</span>}
                  </Link>
                ) : (
                  <>
                    <span className="text-sm font-semibold">{r.userName || "غير معروف"}</span>
                    {r.userPhone && <span className="text-xs text-muted-foreground">{r.userPhone}</span>}
                  </>
                )}
              </div>
            )}
            <div className="flex items-start gap-2 flex-wrap">
              {r.isActive ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">جلسة نشطة</Badge>
              ) : r.logoutType === "expired" ? (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">انتهت الجلسة</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">تسجيل خروج</Badge>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs"><span className="text-muted-foreground">دخول:</span> {formatDateTimeFull(r.loginAt)}</p>
                {r.isActive ? (
                  r.lastSeenAt && <p className="text-xs"><span className="text-muted-foreground">آخر نشاط:</span> {formatTimeAgo(r.lastSeenAt)}</p>
                ) : (
                  r.logoutAt && <p className="text-xs"><span className="text-muted-foreground">خروج:</span> {formatDateTimeFull(r.logoutAt)}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {device}{r.ip ? ` • ${r.ip}` : ""}
                </p>
              </div>
            </div>
          </Card>
        );
      })}

      {total > pageSize && (
        <div className="flex items-center justify-between mt-3 gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>السابق</Button>
          <span className="text-xs text-muted-foreground">صفحة {page + 1} من {totalPages} • {total} جلسة</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      )}
    </div>
  );
}
