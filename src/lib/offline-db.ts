import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "wasl-pos-db";
const DB_VERSION = 1;

export type LocalProduct = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  barcode?: string | null;
  image_url?: string | null;
  category_id?: string | null;
  [key: string]: any;
};

export type LocalCustomer = {
  id: string;
  store_id: string;
  kind: "registered" | "pending";
  name: string;
  phone: string;
};

export type OutboxOp = {
  id: string;
  kind: "sale" | "new_product";
  createdAt: string;
  payload: any;
  status: "pending" | "failed";
  tries: number;
  lastError?: string;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products")) {
          db.createObjectStore("products", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const s = db.createObjectStore("outbox", { keyPath: "id" });
          s.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

// ---------- products ----------
export async function putProducts(items: LocalProduct[]) {
  if (!items.length) return;
  const db = await getDb();
  const tx = db.transaction("products", "readwrite");
  await Promise.all(items.map((it) => tx.store.put(it)));
  await tx.done;
}
export async function putProduct(item: LocalProduct) {
  const db = await getDb();
  await db.put("products", item);
}
export async function getProductsByStore(storeId: string): Promise<LocalProduct[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll("products")) as LocalProduct[];
    return all.filter((p) => p.store_id === storeId);
  } catch {
    return [];
  }
}

// ---------- customers ----------
export async function putCustomers(items: LocalCustomer[]) {
  if (!items.length) return;
  const db = await getDb();
  const tx = db.transaction("customers", "readwrite");
  await Promise.all(items.map((it) => tx.store.put(it)));
  await tx.done;
}
export async function getCustomersByStore(storeId: string): Promise<LocalCustomer[]> {
  try {
    const db = await getDb();
    const all = (await db.getAll("customers")) as LocalCustomer[];
    return all.filter((c) => c.store_id === storeId);
  } catch {
    return [];
  }
}

// ---------- outbox ----------
export async function outboxAdd(op: OutboxOp) {
  const db = await getDb();
  await db.put("outbox", op);
}
export async function outboxAll(): Promise<OutboxOp[]> {
  try {
    const db = await getDb();
    const list = (await db.getAll("outbox")) as OutboxOp[];
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}
export async function outboxDelete(id: string) {
  const db = await getDb();
  await db.delete("outbox", id);
}
export async function outboxUpdate(op: OutboxOp) {
  const db = await getDb();
  await db.put("outbox", op);
}
export async function outboxCount(): Promise<number> {
  try {
    const db = await getDb();
    return await db.count("outbox");
  } catch {
    return 0;
  }
}

// ---------- meta ----------
export async function metaSet(key: string, value: any) {
  const db = await getDb();
  await db.put("meta", value, key);
}
export async function metaGet<T = any>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    return (await db.get("meta", key)) as T | undefined;
  } catch {
    return undefined;
  }
}
