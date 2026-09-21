import { useEffect } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE, refreshSession, tokenStore } from "@/api/client";

export interface AppEvent { type: string; table: string; op: string; id: string; user_ids: string[]; at: string }
type Handler = (e: AppEvent) => void;
const handlers = new Map<string, Set<Handler>>();
let controller: AbortController | null = null;

/** One SSE connection per tab (replaces the per-hook Supabase Realtime channel that leaked). */
function ensureConnection() {
  if (controller || !tokenStore.get()) return;
  controller = new AbortController();
  void fetchEventSource(`${API_BASE}/events`, {
    signal: controller.signal, credentials: "include", openWhenHidden: true,
    headers: { Authorization: `Bearer ${tokenStore.get()}`, "X-Client": "web" },
    async onopen(r) { if (r.status === 401) { await refreshSession(); throw new Error("401"); } },
    onmessage(msg) {
      if (!msg.data || msg.event === "ping") return;
      try { const e = JSON.parse(msg.data) as AppEvent; for (const h of handlers.get(e.type) ?? []) h(e); for (const h of handlers.get("*") ?? []) h(e); } catch { /* ignore */ }
    },
    onerror() { /* library retries with backoff */ },
  });
}
export function disconnectRealtime() { controller?.abort(); controller = null; }
tokenStore.onRefreshed(() => { if (controller) { disconnectRealtime(); ensureConnection(); } });

/** Subscribe to one event type (`notification.created`, `order.updated`, `credit_tx.updated`, `wallet_tx.updated`) or `*`. */
export function useAppEvent(type: string, handler: Handler) {
  useEffect(() => {
    ensureConnection();
    const set = handlers.get(type) ?? new Set<Handler>();
    set.add(handler); handlers.set(type, set);
    return () => { set.delete(handler); };
  }, [type, handler]);
}
