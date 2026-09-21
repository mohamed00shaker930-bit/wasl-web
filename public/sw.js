/* وصل — Service Worker يدوي ثابت (لا يعتمد على أدوات البناء)
   الاستراتيجية: تنقلات الصفحات = شبكة أولاً (مهلة 5 ثوانٍ) ← آخر نسخة مخزّنة ← offline.html
                 الأصول الثابتة = كاش أولاً */

const VERSION = "wasl-sw-v3";
const CORE_CACHE = "baqalati-core-" + VERSION;
const PAGES_CACHE = "baqalati-pages-" + VERSION;
const ASSETS_CACHE = "baqalati-assets-" + VERSION;
const CURRENT_CACHES = [CORE_CACHE, PAGES_CACHE, ASSETS_CACHE];
const OFFLINE_URL = "/offline.html";
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => (n.startsWith("baqalati-") || n.includes("workbox")) && !CURRENT_CACHES.includes(n))
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("network-timeout"));
    }, ms);
    fetch(request, { signal: controller.signal }).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* 1) تنقلات الصفحات */
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/~oauth")) return;
    event.respondWith((async () => {
      try {
        const fresh = await fetchWithTimeout(req, NETWORK_TIMEOUT_MS);
        if (fresh && fresh.ok) {
          const cache = await caches.open(PAGES_CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cachedPage = await caches.match(req);
        if (cachedPage) return cachedPage;
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
        throw err;
      }
    })());
    return;
  }

  /* 2) الأصول الثابتة من نفس الأصل */
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      ["script", "style", "font", "image", "worker"].includes(req.destination));

  if (isStatic) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.ok && (res.type === "basic" || res.type === "default")) {
        const cache = await caches.open(ASSETS_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })());
  }
});
