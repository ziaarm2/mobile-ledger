const CACHE_NAME = 'mobile-ledger-v3';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// The app's HTML changes often as new features get added, so it always goes
// to the network first (to pick up the latest version instantly whenever the
// phone is online) and only falls back to the cached copy if there's no
// internet — that's the one case offline support is actually for. Icons and
// the manifest barely ever change, so those stay cache-first as before.
self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;

  const acceptHeader = event.request.headers.get('accept') || '';
  const isHTML = event.request.mode === 'navigate' || acceptHeader.indexOf('text/html') !== -1;

  if(isHTML){
    event.respondWith(
      fetch(event.request).then(function(resp){
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, respClone); });
        return resp;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached){
      if(cached) return cached;
      return fetch(event.request).catch(function(){ return caches.match('./index.html'); });
    })
  );
});
