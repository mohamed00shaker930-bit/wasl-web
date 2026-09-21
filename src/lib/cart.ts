import { useEffect, useState } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
  imageUrl?: string | null;
};

type CartState = { storeId: string | null; storeName?: string; items: CartItem[] };

const KEY = "baqalati_cart_v1";
const listeners = new Set<() => void>();

function read(): CartState {
  if (typeof window === "undefined") return { storeId: null, items: [] };
  try { return JSON.parse(localStorage.getItem(KEY) || "") as CartState; }
  catch { return { storeId: null, items: [] }; }
}
function write(s: CartState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function useCart() {
  const [state, setState] = useState<CartState>(() => read());
  useEffect(() => {
    const l = () => setState(read());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

export const cart = {
  add(storeId: string, storeName: string, item: CartItem) {
    const s = read();
    if (s.storeId && s.storeId !== storeId) {
      // Switching store; reset cart
      write({ storeId, storeName, items: [item] });
      return;
    }
    const existing = s.items.find((i) => i.productId === item.productId);
    if (existing) existing.qty += item.qty;
    else s.items.push(item);
    write({ storeId, storeName, items: s.items });
  },
  setQty(productId: string, qty: number) {
    const s = read();
    s.items = s.items.map((i) => i.productId === productId ? { ...i, qty } : i).filter((i) => i.qty > 0);
    if (!s.items.length) s.storeId = null;
    write(s);
  },
  remove(productId: string) {
    const s = read();
    s.items = s.items.filter((i) => i.productId !== productId);
    if (!s.items.length) s.storeId = null;
    write(s);
  },
  setNote(productId: string, note: string) {
    const s = read();
    s.items = s.items.map((i) => i.productId === productId ? { ...i, note } : i);
    write(s);
  },
  clear() { write({ storeId: null, items: [] }); },
  total(): number {
    return read().items.reduce((sum, i) => sum + i.price * i.qty, 0);
  },
};
