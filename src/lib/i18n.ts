import { useSyncExternalStore } from "react";

export type Lang = "ar" | "en";
const KEY = "baqalati_lang";
const listeners = new Set<() => void>();

function get(): Lang {
  if (typeof window === "undefined") return "ar";
  return (localStorage.getItem(KEY) as Lang) || "ar";
}
export function setLang(l: Lang) {
  localStorage.setItem(KEY, l);
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  listeners.forEach((fn) => fn());
}
export function initLang() {
  if (typeof document === "undefined") return;
  const l = get();
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    get,
    () => "ar"
  );
}

const dict = {
  ar: {
    home: "الرئيسية", orders: "الطلبات", cart: "السلة", profile: "حسابي",
    favorites: "المفضلة", wallet: "المحفظة", notifications: "الإشعارات",
    language: "اللغة", arabic: "العربية", english: "الإنجليزية",
    nearby: "البقالات الأقرب", search_stores: "ابحث عن بقالة...",
    order_again: "اطلب مرة أخرى",
  },
  en: {
    home: "Home", orders: "Orders", cart: "Cart", profile: "Profile",
    favorites: "Favorites", wallet: "Wallet", notifications: "Notifications",
    language: "Language", arabic: "Arabic", english: "English",
    nearby: "Nearby stores", search_stores: "Search stores...",
    order_again: "Order again",
  },
} as const;

export function t(key: keyof typeof dict["ar"]): string {
  return dict[get()][key] ?? key;
}
