/* Only the offline fallback document is cached for navigations. API responses,
   certificate files, search results and all other navigations are never cached. */
const CACHE_NAME = "sis-static-v4";
/* Local development must never be served from a cache: stale CSS/JS made new layouts look broken. */
const IS_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);
const OFFLINE_URL = "/offline";
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    if (IS_DEV) { await self.skipWaiting(); return; }
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll([OFFLINE_URL, "/offline.css", "/icons/icon-192.png"]).catch(() => undefined);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("sis-static-") && (IS_DEV || name !== CACHE_NAME)).map(name => caches.delete(name)));
    if (IS_DEV) { await self.registration.unregister(); return; }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (IS_DEV) return;
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok || response.status < 500) return response;
      } catch { /* network failure: serve the one cached offline document */ }
      const cached = await caches.match(OFFLINE_URL);
      return cached || new Response("Offline. Please reconnect and try again.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    })());
    return;
  }
  // Cache only static assets, never API endpoints or private certificate paths.
  if (url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/certificates/") || url.pathname.includes("/search") || url.pathname.includes("/verify")) return;
  if (!["style", "script", "font", "image"].includes(request.destination)) return;
  // Only content-hashed or versioned static files are cache-first; everything else always hits the network.
  if (!(url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/"))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  })());
});
