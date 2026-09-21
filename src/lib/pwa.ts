const APP_SW_PATH = "/sw.js";

function isPreviewHost(_hostname: string) {
  return false; // no longer hosted on Lovable
}

function isInsideIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function shouldSkipServiceWorker() {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (isInsideIframe()) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function removeAppCaches() {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.allSettled(
    names
      .filter((name) => name.startsWith("baqalati-") || name.includes("workbox"))
      .map((name) => caches.delete(name)),
  );
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const worker = registration.active || registration.waiting || registration.installing;
        if (!worker) return false;
        return new URL(worker.scriptURL).pathname === APP_SW_PATH;
      })
      .map((registration) => registration.unregister()),
  );
  await removeAppCaches();
}

export function registerBaqalatiPwa() {
  if (!("serviceWorker" in navigator)) return;

  if (shouldSkipServiceWorker()) {
    unregisterAppServiceWorkers().catch(() => undefined);
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(APP_SW_PATH).catch(() => undefined);
  });
}