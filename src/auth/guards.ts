import { redirect } from "@tanstack/react-router";
import { auth } from "./store";

/** beforeLoad helpers. Cosmetic only: the API enforces everything; these avoid rendering pages that will fail. */
export async function requireAuth() {
  const s = await auth.ready();
  if (s.status !== "authed" || !s.me) throw redirect({ to: "/auth" });
  if (s.me.user.force_password_change) throw redirect({ to: "/change-password" });
  return s.me;
}
export async function requireMerchant() {
  const me = await requireAuth();
  if (auth.role(me) !== "merchant") throw redirect({ to: "/home" });
  return me;
}
export async function requireAdmin() {
  const me = await requireAuth();
  if (!auth.isAdmin(me)) throw redirect({ to: "/home" });
  return me;
}
export function homeFor(me: Parameters<typeof auth.role>[0]): "/admin" | "/merchant" | "/home" {
  if (auth.isAdmin(me)) return "/admin";
  return auth.role(me) === "merchant" ? "/merchant" : "/home";
}
