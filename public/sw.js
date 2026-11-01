/* Only the offline fallback document is cached for navigations. API responses,
   certificate files, search results and all other navigations are never cached. */
const CACHE_NAME = "sis-static-v4";
/* Local development must never be served from a cache: stale CSS/JS made new layouts look broken. */
const IS_DEV = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);
const OFFLINE_URL = "/offline";
const PRIVATE_PATH_PREFIXES = ["/_next/image", "/api/", "/admin", "/certificates/"];
const PRIVATE_PATH_FRAGMENTS = ["/search", "/verify"];
const STATIC_PATH_PREFIXES = ["/_next/static/", "/fonts/", "/icons/"];

function canHandleRequest(request, url) {
  return !IS_DEV && request.method === "GET" && url.origin === self.location.origin;
}

function isPrivatePath(pathname) {
  return (
    PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    PRIVATE_PATH_FRAGMENTS.some((fragment) => pathname.includes(fragment))
  );
}

function shouldCacheAsset(request, url) {
  return (
    ["style", "script", "font", "image"].includes(request.destination) &&
    STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  );
}

async function navigate(request) {
  try {
    const response = await fetch(request);
    if (response.ok || response.status < 500) return response;
  } catch {
    /* network failure: serve the one cached offline document */
  }
  const cached = await caches.match(OFFLINE_URL);
  return (
    cached ||
    new Response("Offline. Please reconnect and try again.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    })
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (IS_DEV) {
        await self.skipWaiting();
        return;
      }
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, "/offline.css", "/icons/icon-192.png"]).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("sis-static-") && (IS_DEV || name !== CACHE_NAME))
          .map((name) => caches.delete(name)),
      );
      if (IS_DEV) {
        await self.registration.unregister();
        return;
      }
      await self.clients.claim();
    })(),
  );
});
function handleFetch(event) {
  const request = event.request;
  const url = new URL(request.url);
  if (!canHandleRequest(request, url)) return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  // Cache only static assets, never API endpoints or private certificate paths.
  if (isPrivatePath(url.pathname) || !shouldCacheAsset(request, url)) return;
  // Only content-hashed or versioned static files are cache-first; everything else always hits the network.
  event.respondWith(cacheFirst(request));
}

self.addEventListener("fetch", handleFetch);
