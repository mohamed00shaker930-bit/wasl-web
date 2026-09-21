import { createFileRoute, redirect } from "@tanstack/react-router";
import { auth } from "@/auth/store";
import { homeFor } from "@/auth/guards";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const s = await auth.ready();
    if (s.status !== "authed" || !s.me) throw redirect({ to: "/auth", replace: true });
    if (s.me.user.force_password_change) throw redirect({ to: "/change-password", replace: true });
    throw redirect({ to: homeFor(s.me), replace: true });
  },
  component: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  ),
});
