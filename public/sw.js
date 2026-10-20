/* Athena service worker: offline shell + Web Push. Plain JS, no build step. */

const VERSION = 'athena-v1';
const ASSET_CACHE = 'athena-assets';
const PAGE_CACHE = 'athena-pages';
const KEEP = [ASSET_CACHE, PAGE_CACHE];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !KEEP.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Static assets: cache-first into "athena-assets". */
async function assetCacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Navigations: network-first, falling back to the cached page, then "/". */
async function pageNetworkFirst(request, cacheKey) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    const root = await cache.match('/');
    if (root) return root;
    return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  const sameOrigin = url.origin === self.location.origin;

  // (a) static assets and fonts -> cache-first
  const isAsset =
    (sameOrigin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com';
  if (isAsset) {
    event.respondWith(assetCacheFirst(request));
    return;
  }

  // (b) navigations -> network-first into the page cache
  // (keyed by path + query: /workouts/progress?exercise=X is its own page)
  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request, url.pathname + url.search));
    return;
  }

  // (c) same-origin API -> network only (never cached)
  if (sameOrigin && url.pathname.startsWith('/api/')) {
    return;
  }

  // everything else: passthrough
});

/*
 * Cached pages belong to whoever was signed in when they were fetched. The
 * login screen posts 'clear-pages' so another person on the same device can
 * never be served a previous user's cached pages while offline.
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-pages') {
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = (payload && payload.title) || 'Athena';
  const body = (payload && payload.body) || '';
  const url = (payload && payload.url) || '/';
  const tag = payload && payload.tag;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        let clientPath;
        try {
          clientPath = new URL(client.url).pathname;
        } catch {
          continue;
        }
        if (clientPath === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
