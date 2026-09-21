// تتبّع فتح/إغلاق التطبيق لكل مستخدم — نفس السلوك السابق عبر /me/sessions.
import { API_BASE, http } from "@/api/client";
import { getAuth } from "@/auth/store";

let initialized = false;
let current: { id: string; beacon_token: string } | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function stopPing() { if (pingTimer) { clearInterval(pingTimer); pingTimer = null; } }
function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (!current || document.visibilityState !== "visible") return;
    http.post(`/me/sessions/${current.id}/ping`).catch(() => undefined);
  }, 60_000);
}
async function openSession() {
  try {
    if (current || getAuth().status !== "authed") return;
    current = await http.post<{ id: string; beacon_token: string }>("/me/sessions", { user_agent: navigator.userAgent });
    startPing();
  } catch { /* best effort */ }
}
function closeSession(closeType: "pagehide" | "logout" = "pagehide") {
  const s = current; current = null; stopPing();
  if (!s) return;
  // sendBeacon cannot set headers; the beacon token authenticates the close instead of the JWT
  const body = new Blob([JSON.stringify({ beacon_token: s.beacon_token, close_type: closeType })], { type: "application/json" });
  if (!navigator.sendBeacon?.(`${API_BASE}/me/sessions/${s.id}/close`, body)) {
    fetch(`${API_BASE}/me/sessions/${s.id}/close`, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
  }
}

export function initAppUsageTracking() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") closeSession(); else void openSession(); });
  window.addEventListener("pagehide", () => closeSession());
}
/** Called by the auth store transitions. */
export const appUsage = { onSignedIn: () => void openSession(), onSignedOut: () => closeSession("logout") };
