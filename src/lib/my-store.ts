import { http } from "@/api/client";
import { metaGet, metaSet } from "./offline-db";

const STORE_META_KEY = "my-store";
/** The merchant's store, cached in IndexedDB so the POS keeps working offline. */
export async function fetchMyStore() {
  try {
    const data = await http.get<Record<string, unknown> | null>("/merchant/store");
    if (data) { try { await metaSet(STORE_META_KEY, data); } catch { /* private mode */ } }
    return data;
  } catch {
    return (await metaGet<Record<string, unknown>>(STORE_META_KEY)) ?? null;
  }
}
