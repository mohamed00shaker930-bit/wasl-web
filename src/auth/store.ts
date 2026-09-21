import { useSyncExternalStore } from "react";
import { http, refreshSession, tokenStore, ApiError } from "@/api/client";

export type AppRole = "customer" | "merchant" | "super_admin" | "admin" | "operations" | "support" | "finance";
export interface MeResponse {
  user: { id: string; phone: string; name: string | null; account_status: string; user_type: string | null; force_password_change: boolean };
  roles: AppRole[]; perms: string[]; super: boolean; is_staff: boolean;
  store: Record<string, unknown> & { id: string; name: string; status: string } | null;
}
export interface AuthState {
  status: "loading" | "anon" | "authed";
  me: MeResponse | null;
}

let state: AuthState = { status: "loading", me: null };
const listeners = new Set<() => void>();
const set = (next: AuthState) => { state = next; for (const l of listeners) l(); };
let bootPromise: Promise<AuthState> | null = null;

async function loadMe(): Promise<AuthState> {
  try {
    const me = await http.get<MeResponse>("/auth/me");
    const next: AuthState = { status: "authed", me };
    set(next);
    return next;
  } catch {
    tokenStore.set(null);
    const next: AuthState = { status: "anon", me: null };
    set(next);
    return next;
  }
}

/** Replaces supabase.auth.getSession(): one refresh from the cookie on boot, then /auth/me. */
export function bootstrap(): Promise<AuthState> {
  if (!bootPromise) {
    bootPromise = (async () => {
      if (tokenStore.get()) return loadMe();
      const ok = await refreshSession();
      if (!ok) { const next: AuthState = { status: "anon", me: null }; set(next); return next; }
      return loadMe();
    })();
  }
  return bootPromise;
}
/** Awaits the initial bootstrap (route beforeLoad guards use this). */
export function ensureSession(): Promise<AuthState> {
  return state.status === "loading" ? bootstrap() : Promise.resolve(state);
}

export async function login(phone: string, password: string): Promise<MeResponse> {
  const r = await http.post<{ access_token: string; user: { force_password_change: boolean } }>("/auth/login", { phone, password });
  tokenStore.set(r.access_token);
  bootPromise = Promise.resolve(state);
  const next = await loadMe();
  if (next.status !== "authed" || !next.me) throw new ApiError(401, "invalid_token");
  return next.me;
}
export async function logout() {
  try { await http.post("/auth/logout", {}, undefined); } catch { /* cookie may already be gone */ }
  tokenStore.set(null);
  set({ status: "anon", me: null });
}
export const refreshMe = () => loadMe();

tokenStore.onSessionLost(() => { if (state.status === "authed") set({ status: "anon", me: null }); });

export function getAuth() { return state; }
export function useAuth(): AuthState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}

// ---- helpers used by the old code paths ----
export function roleOf(me: MeResponse | null): "customer" | "merchant" | null {
  if (!me) return null;
  if (me.roles.includes("merchant")) return "merchant";
  if (me.roles.includes("customer")) return "customer";
  return null;
}
export const isAdminUser = (me: MeResponse | null) => !!me && (me.super || me.is_staff);
/** Where a signed-in user lands, same priority as the old index route. */
export function homeFor(me: MeResponse): "/admin" | "/merchant" | "/home" {
  if (me.user.force_password_change) return "/home"; // caller redirects to /change-password first
  if (isAdminUser(me)) return "/admin";
  return roleOf(me) === "merchant" ? "/merchant" : "/home";
}

/** Object-style facade used by routes/guards (`auth.ready()`, `auth.login()`, `auth.role()`, `auth.isAdmin()`). */
export const auth = {
  get state() { return state; },
  ready: ensureSession,
  get: getAuth,
  login,
  logout,
  refresh: refreshMe,
  role: roleOf,
  isAdmin: isAdminUser,
};
