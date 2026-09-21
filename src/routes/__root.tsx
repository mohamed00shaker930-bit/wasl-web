import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LockScreen } from "@/components/LockScreen";
import { initLang } from "@/lib/i18n";
import { registerBaqalatiPwa } from "@/lib/pwa";
import { appUsage, initAppUsageTracking } from "@/lib/appUsage";
import { useAuth } from "@/auth/store";
import { bindQueryClient } from "@/lib/pos-outbox";
import { disconnectRealtime } from "@/lib/realtime";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">٤٠٤</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">الرابط الذي زرته غير صحيح أو تم نقله.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">حاول التحديث أو العودة للرئيسية.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">إعادة المحاولة</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => { initLang(); registerBaqalatiPwa(); initAppUsageTracking(); bindQueryClient(queryClient); }, [queryClient]);

  // session transitions (was supabase.auth.onAuthStateChange)
  useEffect(() => {
    if (auth.status === "loading") return;
    router.invalidate();
    if (auth.status === "authed") { queryClient.invalidateQueries(); appUsage.onSignedIn(); }
    else { appUsage.onSignedOut(); disconnectRealtime(); queryClient.clear(); }
  }, [auth.status, router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <LockScreen />
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
