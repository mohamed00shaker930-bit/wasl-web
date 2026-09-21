/**
 * Single HTTP client for wasl-api. Access token lives in memory only; the refresh token is an httpOnly cookie on
 * /api/auth (same origin), so a 401 triggers one refresh and one retry. Errors surface as ApiError with the API's
 * machine-readable `code`; Arabic text comes from ./errors.ts.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: Record<string, unknown>) {
    super(code);
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let onTokenRefreshed: ((token: string) => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t; },
  onSessionLost: (cb: () => void) => { onSessionLost = cb; },
  onRefreshed: (cb: (t: string) => void) => { onTokenRefreshed = cb; },
};

type Query = Record<string, string | number | boolean | null | undefined>;
export interface RequestOptions { method?: string; body?: unknown; query?: Query; headers?: Record<string, string>; signal?: AbortSignal; skipAuthRetry?: boolean }

function withQuery(path: string, query?: Query) {
  if (!query) return `${API_BASE}${path}`;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `${API_BASE}${path}${s ? `?${s}` : ""}`;
}

let refreshing: Promise<boolean> | null = null;
/** POST /auth/refresh with the cookie. Shared between concurrent 401s. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-Client": "web", "Content-Type": "application/json" }, body: "{}" });
        if (!r.ok) return false;
        const body = (await r.json()) as { access_token: string };
        accessToken = body.access_token;
        onTokenRefreshed?.(body.access_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers: Record<string, string> = { "X-Client": "web", ...(opts.headers ?? {}) };
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(withQuery(path, opts.query), {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers, credentials: "include", signal: opts.signal,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  });
  if (res.status === 401 && !opts.skipAuthRetry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(path, { ...opts, skipAuthRetry: true });
    accessToken = null;
    onSessionLost?.();
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; details?: Record<string, unknown>; message?: unknown };
    throw new ApiError(res.status, d.error ?? (res.status === 401 ? "invalid_token" : "internal"), { ...(d.details ?? {}), ...(d.message ? { message: d.message } : {}) });
  }
  return data as T;
}

export const http = {
  get: <T = unknown>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T = unknown>(path: string, body?: unknown, query?: Query) => request<T>(path, { method: "POST", body: body ?? {}, query }),
  patch: <T = unknown>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T = unknown>(path: string, body: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
  upload: <T = unknown>(path: string, file: File | Blob, filename?: string) => {
    const fd = new FormData();
    fd.append("file", file, filename ?? (file instanceof File ? file.name : "upload"));
    return request<T>(path, { method: "POST", body: fd });
  },
};

export { errorMessage, isNetworkError } from "./errors";
