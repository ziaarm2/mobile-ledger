/* Mobile Hisab offline shell cache — v45.
 * Keep this file beside index.html at the same hosted path/scope.
 * Firestore/Auth network calls are deliberately never cached.
 */
const CACHE_NAME = 'mobile-hisab-shell-v45';
const OLD_CACHE_PREFIX = 'mobile-hisab-shell-';
const CORE_FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const path of CORE_FILES) {
      try {
        const url = new URL(path, self.registration.scope).href;
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch (_) { /* optional icon/manifest may not exist in every deployment */ }
    }
    // Cache the SDK files so an already-authorized install can reopen offline.
    for (const url of CDN_ASSETS) {
      try {
        const response = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        if (response && (response.ok || response.type === 'opaque')) await cache.put(url, response);
      } catch (_) { /* retain any previous cached SDK copy */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(OLD_CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never intercept Firestore/Auth/API traffic: it must reflect real network state.
  if (/firestore|identitytoolkit|securetoken|googleapis\.com\/v1|firebaseapp\.com/.test(url.hostname + url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const indexUrl = new URL('index.html', self.registration.scope).href;
          await cache.put(indexUrl, fresh.clone());
          return fresh;
        }
      } catch (_) {}
      const exact = await cache.match(request, { ignoreSearch: true });
      if (exact) return exact;
      const indexUrl = new URL('index.html', self.registration.scope).href;
      const shell = await cache.match(indexUrl);
      if (shell) return shell;
      return new Response('Mobile Hisab offline shell abhi cache nahi hua. Internet connect karke app ek dafa kholein.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isSdk = CDN_ASSETS.includes(request.url.split('?')[0]);
  if (sameOrigin || isSdk) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        // Refresh cache in the background when online, but never block cached UI.
        fetch(request).then(response => {
          if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
        }).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (cached) return cached;
        throw error;
      }
    })());
  }
});
