// PIN-based app lock — 4 digits, SHA-256 + per-device salt in localStorage.
const HASH_KEY = "app_pin_hash";
const SALT_KEY = "app_pin_salt";
const ENABLED_KEY = "app_lock_enabled";
const LOCKED_KEY = "app_locked";
const DURATION_KEY = "app_lock_duration"; // minutes; 0 = every entry
const IDLE_KEY = "app_lock_idle_enabled"; // "1" | "0"
const HIDE_KEY = "app_lock_hide_enabled"; // "1" | "0"
const LAST_ACTIVE_KEY = "app_lock_last_active";

export const PIN_LENGTH = 4;

// minutes — 0 means require PIN on every entry/return
export const LOCK_DURATIONS = [
  { value: 0, label: "كل مرة دخول" },
  { value: 10, label: "بعد 10 دقائق" },
  { value: 30, label: "بعد 30 دقيقة" },
  { value: 60, label: "بعد ساعة" },
  { value: 180, label: "بعد 3 ساعات" },
  { value: 480, label: "بعد 8 ساعات" },
] as const;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text: string) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return toHex(buf);
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

export function isPinSet() {
  if (typeof localStorage === "undefined") return false;
  return !!localStorage.getItem(HASH_KEY);
}

export function isLockEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1" && isPinSet();
}

export function setLockEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

// duration in minutes (0..480). Default 10.
export function getLockDuration(): number {
  if (typeof localStorage === "undefined") return 10;
  const v = localStorage.getItem(DURATION_KEY);
  if (v === null) return 10;
  const n = Number(v);
  return Number.isFinite(n) ? n : 10;
}
export function setLockDuration(minutes: number) {
  localStorage.setItem(DURATION_KEY, String(minutes));
}

// idle-timeout auto-lock toggle (default: on)
export function isIdleLockEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(IDLE_KEY);
  return v === null ? true : v === "1";
}
export function setIdleLockEnabled(on: boolean) {
  localStorage.setItem(IDLE_KEY, on ? "1" : "0");
}

// lock-on-hide toggle (default: on)
export function isHideLockEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(HIDE_KEY);
  return v === null ? true : v === "1";
}
export function setHideLockEnabled(on: boolean) {
  localStorage.setItem(HIDE_KEY, on ? "1" : "0");
}

export function markActive() {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
}
export function getLastActive(): number {
  const v = localStorage.getItem(LAST_ACTIVE_KEY);
  return v ? Number(v) || 0 : 0;
}

export async function setPin(pin: string) {
  if (pin.length !== PIN_LENGTH) throw new Error(`الرمز ${PIN_LENGTH} أرقام`);
  const salt = randomSalt();
  const hash = await sha256(salt + pin);
  localStorage.setItem(SALT_KEY, salt);
  localStorage.setItem(HASH_KEY, hash);
  localStorage.setItem(ENABLED_KEY, "1");
}

export async function verifyPin(pin: string) {
  const salt = localStorage.getItem(SALT_KEY);
  const hash = localStorage.getItem(HASH_KEY);
  if (!salt || !hash) return false;
  const calc = await sha256(salt + pin);
  return calc === hash;
}

export function clearPin() {
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(LOCKED_KEY);
}

export function markLocked() {
  localStorage.setItem(LOCKED_KEY, "1");
}
export function markUnlocked() {
  localStorage.removeItem(LOCKED_KEY);
  markActive();
}
export function isLockedNow() {
  return localStorage.getItem(LOCKED_KEY) === "1";
}
