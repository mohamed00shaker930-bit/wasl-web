import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { http } from "@/api/client";
import type { Paged } from "@/api/admin";
import { formatDateTimeFull, formatTimeAgo } from "@/lib/dateFormat";
import { roleLabel } from "@/lib/audit-dict";
import { AuditLogList } from "@/components/admin/AuditLogList";
import { LoginSessionsList } from "@/components/admin/LoginSessionsList";
import { AppUsageList } from "@/components/admin/AppUsageList";
import { lastActivityAt, type UserFile } from "@/components/admin/UserFilesList";
import { ArrowRight, Activity, LogIn, Smartphone, ListChecks, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/user-file/$userId")({ component: Page });

const ROLE_CLS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  admin: "bg-indigo-100 text-indigo-700",
  operations: "bg-blue-100 text-blue-700",
  support: "bg-teal-100 text-teal-700",
  finance: "bg-orange-100 text-orange-700",
  merchant: "bg-emerald-100 text-emerald-700",
  customer: "bg-sky-100 text-sky-700",
  system: "bg-slate-200 text-slate-700",
  unknown: "bg-muted text-muted-foreground",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold mt-1 truncate">{value}</p>
    </Card>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 mt-4">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Page() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<UserFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await http.get<Paged<UserFile>>("/admin/user-files", { user_id: userId, limit: 1, offset: 0 });
        if (cancelled) return;
        setRow(r.items[0] ?? null);
      } catch {
        if (cancelled) return;
        setRow(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const filter = { userId };
  const lastActivity = row ? lastActivityAt(row) : null;

  return (
    <AdminShell
      title="ملف المستخدم"
      action={
        <Button size="sm" variant="ghost" className="text-background hover:bg-background/10" onClick={() => navigate({ to: "/admin/audit" })}>
          <ArrowRight className="w-4 h-4 ms-1" /> رجوع
        </Button>
      }
    >
      {loading ? (
        <p className="text-center text-muted-foreground py-8 text-sm">جاري التحميل...</p>
      ) : !row ? (
        <p className="text-center text-muted-foreground py-8 text-sm">لم يتم العثور على المستخدم</p>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold">{row.userName || "غير معروف"}</h2>
                  {row.isOpenNow && (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">مفتوح الآن</Badge>
                  )}
                </div>
                {row.userPhone && <p className="text-xs text-muted-foreground mt-1">{row.userPhone}</p>}
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge variant="secondary" className={`text-[10px] ${ROLE_CLS[row.userRole || "unknown"] || ROLE_CLS.unknown}`}>
                    {roleLabel(row.userRole)}
                  </Badge>
                  {row.registeredAt && (
                    <span className="text-[11px] text-muted-foreground">تاريخ التسجيل: {formatDateTimeFull(row.registeredAt)}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <StatCard label="العمليات" value={row.totalActions} icon={ListChecks} />
            <StatCard label="تسجيلات الدخول" value={row.totalLogins} icon={LogIn} />
            <StatCard label="مرات فتح التطبيق" value={row.totalOpens} icon={Smartphone} />
            <StatCard label="آخر نشاط" value={lastActivity ? formatTimeAgo(lastActivity) : "—"} icon={Clock} />
          </div>

          <Section title="سجل العمليات" icon={Activity}>
            <AuditLogList filter={filter} pageSize={10} />
          </Section>

          <Section title="تسجيلات الدخول والخروج" icon={LogIn}>
            <LoginSessionsList userId={userId} pageSize={10} />
          </Section>

          <Section title="فتح وإغلاق التطبيق" icon={Smartphone}>
            <AppUsageList userId={userId} pageSize={10} />
          </Section>
        </>
      )}
    </AdminShell>
  );
}
