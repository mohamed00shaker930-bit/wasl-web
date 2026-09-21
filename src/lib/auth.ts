import { getAuth, login as storeLogin, roleOf } from "@/auth/store";

/** Yemeni mobile: 9 digits, starts with 77/78/71/73 (no country code). */
export function isValidYemeniPhone(p: string): boolean {
  return /^(77|78|71|73)\d{7}$/.test(p);
}
/** Kept for the unit test only; the API identifies users by phone directly. */
export function phoneToEmail(phone: string): string {
  return `${phone}@baqalati.app`;
}
export async function signIn(phone: string, password: string) {
  return storeLogin(phone, password);
}
/** Role of the signed-in user (merchant-first, as before). userId is ignored: the API only knows the caller. */
export async function getUserRole(_userId?: string): Promise<"customer" | "merchant" | null> {
  return roleOf(getAuth().me);
}
