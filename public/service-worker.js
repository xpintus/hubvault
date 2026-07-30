const CACHE_NAME = 'hubvault-cache-v2'; // Bumped version
const OFFLINE_URL = '/offline.html';

// Static assets to cache for offline support (excluding index.html)
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/offline.html',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/logo.png',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting();
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim clients to immediately control all open pages
      return self.clients.claim();
    })
  );
});

// Fetch event: handle requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Supabase API requests - Network Only (do not cache sensitive/dynamic data)
  if (url.origin.includes('supabase.co') || url.pathname.startsWith('/rest/v1/') || url.pathname.startsWith('/auth/v1/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Local API requests or external services that shouldn't be cached
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. HTML Navigation requests - Network First, fallback to Offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // 4. Static assets, JS, CSS, Images - Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Only cache valid responses for static assets (js, css, images, fonts)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response because it can only be consumed once
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // Cache JS, CSS, Web Fonts, Images dynamically
          if (url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.woff') ||
              url.pathname.endsWith('.woff2') ||
              url.pathname.match(/\.(png|jpg|jpeg|svg|gif)$/i)) {
            cache.put(event.request, responseToCache);
          }
        });

        return networkResponse;
      });
    })
  );
});
