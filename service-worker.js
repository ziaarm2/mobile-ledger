const CACHE_NAME = 'mobile-hisab-v25';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Deliberately no fetch handler: the app is served fresh from the network.
// This prevents an older cached index/manifest from keeping the old app name
// or Google-login screen alive after an update.
