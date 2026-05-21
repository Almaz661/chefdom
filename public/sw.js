// F.3 — Service Worker для offline режима
// Кэширует рецепты и список покупок, работает без сети

const CACHE_NAME = 'shefdom-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// При установке — кэшируем статику
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// При активации — удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Стратегия: Network First для API, Cache First для статики
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API запросы — только сеть, без кэша
  if (url.pathname.startsWith('/trpc') || url.pathname.startsWith('/api')) {
    return;
  }

  // Статика и страницы — Cache First с fallback на сеть
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Кэшируем только успешные GET запросы
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Если нет сети и нет кэша — отдаём главную страницу (SPA fallback)
        return caches.match('/');
      });
    })
  );
});
