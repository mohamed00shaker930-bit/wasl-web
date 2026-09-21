import { useSyncExternalStore } from "react";
import { http, ApiError } from "@/api/client";
import { isNetworkError as isNetErr } from "@/api/errors";
import {
  outboxAdd,
  outboxAll,
  outboxCount,
  outboxDelete,
  outboxUpdate,
  type OutboxOp,
} from "./offline-db";
import { toast } from "sonner";
import { QueryClient } from "@tanstack/react-query";

// ---------- pub/sub ----------
const listeners = new Set<() => void>();
let state = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  syncing: false,
  lastError: undefined as string | undefined,
};

function notify() {
  for (const l of listeners) l();
}
function setState(partial: Partial<typeof state>) {
  state = { ...state, ...partial };
  notify();
}

async function refreshCount() {
  const c = await outboxCount();
  if (c !== state.pendingCount) setState({ pendingCount: c });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    setState({ isOnline: true });
    void flush();
  });
  window.addEventListener("offline", () => setState({ isOnline: false }));
  // initial count
  void refreshCount();
  // periodic
  setInterval(() => {
    if (state.pendingCount > 0 && state.isOnline && !state.syncing) void flush();
  }, 60_000);
}

let queryClientRef: QueryClient | null = null;
export function bindQueryClient(qc: QueryClient) {
  queryClientRef = qc;
}

// ---------- API ----------
export async function enqueue(op: Omit<OutboxOp, "status" | "tries">) {
  const full: OutboxOp = { ...op, status: "pending", tries: 0 };
  await outboxAdd(full);
  await refreshCount();
}

export async function listPending(): Promise<OutboxOp[]> {
  return outboxAll();
}

export async function pendingCount(): Promise<number> {
  return outboxCount();
}

export async function retryFailed() {
  const all = await outboxAll();
  for (const op of all) {
    if (op.status === "failed") {
      await outboxUpdate({ ...op, status: "pending", lastError: undefined });
    }
  }
  await refreshCount();
  return flush();
}

/** Network failure or 5xx: keep the op pending and stop this round. Any 4xx is a permanent failure for this op. */
function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500 || err.status === 429;
  return isNetErr(err);
}

type Result = { ok: boolean; retry?: boolean; err?: any };

/** POST /merchant/pos/products — idempotent on the client-generated product id (201 new, 200 replay). */
async function processNewProduct(op: OutboxOp): Promise<Result> {
  try {
    const p = op.payload as Record<string, unknown>;
    await http.post("/merchant/pos/products", {
      op_id: op.id, id: p.id, name: p.name, price: Number(p.price ?? 0), category_id: p.category_id ?? null,
      barcode: p.barcode ?? null, in_stock: p.in_stock ?? true, image_url: typeof p.image_url === "string" && !p.image_url.startsWith("data:") ? p.image_url : null,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, retry: isRetryable(err), err };
  }
}

/** POST /merchant/pos/sales — the whole envelope in one call; the server stores it atomically and replays are 200. */
async function processSale(op: OutboxOp): Promise<Result> {
  const { order, items, credit } = op.payload as {
    order: any;
    items: any[];
    credit?: { customerKind: "registered" | "pending"; customerId: string; txId: string; amount: number; note?: string | null };
  };
  try {
    await http.post("/merchant/pos/sales", {
      op_id: op.id,
      order: { id: order.id, customer_id: order.customer_id ?? null, payment_method: order.payment_method, note: order.note ?? null, created_at: order.created_at, total: order.total != null ? Number(order.total) : undefined },
      items: items.map((i) => ({ id: i.id, product_id: i.product_id ?? null, name: i.name, price: Number(i.price), qty: Number(i.qty), note: i.note ?? null })),
      credit: credit ?? null,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, retry: isRetryable(err), err };
  }
}

let flushing = false;
export async function flush(): Promise<{ success: number; failed: number }> {
  if (flushing) return { success: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { success: 0, failed: 0 };
  flushing = true;
  setState({ syncing: true, lastError: undefined });
  let success = 0;
  let failed = 0;
  try {
    const all = await outboxAll();
    // new_product first, then sale — but preserve FIFO within each
    const products = all.filter((o) => o.kind === "new_product" && o.status !== "failed");
    const sales = all.filter((o) => o.kind === "sale" && o.status !== "failed");
    const ordered = [...products, ...sales];

    for (const op of ordered) {
      const res =
        op.kind === "new_product" ? await processNewProduct(op) : await processSale(op);
      if (res.ok) {
        await outboxDelete(op.id);
        success += 1;
      } else if (res.retry) {
        // network — stop this round
        setState({ lastError: String(res.err?.message ?? res.err ?? "network") });
        break;
      } else {
        await outboxUpdate({
          ...op,
          status: "failed",
          tries: op.tries + 1,
          lastError: String(res.err?.message ?? res.err ?? "error"),
        });
        failed += 1;
      }
    }
  } finally {
    flushing = false;
    setState({ syncing: false });
    await refreshCount();
  }

  if (success > 0) {
    if (queryClientRef) {
      queryClientRef.invalidateQueries({ queryKey: ["reports-orders"] });
      queryClientRef.invalidateQueries({ queryKey: ["merchant-orders"] });
      queryClientRef.invalidateQueries({ queryKey: ["pos-products"] });
      queryClientRef.invalidateQueries({ queryKey: ["my-products"] });
      queryClientRef.invalidateQueries({ queryKey: ["merchant-credit"] });
    }
    toast.success(`تمت مزامنة ${success} فاتورة`);
  }
  return { success, failed };
}

// ---------- hook ----------
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return state;
}
function getServerSnapshot() {
  return state;
}
export function usePosSync() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
