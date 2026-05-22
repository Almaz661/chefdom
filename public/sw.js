// F.3 — Service Worker для offline режима
// Кэширует ассеты, работает без сети.
//
// Стратегия:
//   - HTML страницы (navigation): Network First — всегда свежий index.html
//     если есть сеть; иначе fallback на кеш. Это критично для авто-обновления
//     после деплоя — иначе пользователь застревает на старой версии.
//   - API (/trpc, /api): только сеть, без кеша.
//   - Остальная статика (JS/CSS/шрифты/иконки): Cache First с фоновым
//     обновлением, плюс кеш только успешных GET-ответов.
//
// При смене CACHE_NAME (бамп версии при деплое) старые кеши очищаются
// в activate. Это страховка от ситуации «пользователь застрял на v1».

const CACHE_NAME = 'shefdom-v3';
const STATIC_ASSETS = ['/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // API — только сеть, без кеша
  if (url.pathname.startsWith('/trpc') || url.pathname.startsWith('/api')) {
    return;
  }

  // Только GET имеет смысл кешировать
  if (req.method !== 'GET') return;

  // HTML / навигация — Network First (чтобы новый деплой подхватился сразу)
  const isHtml =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Остальное (JS/CSS/шрифты/картинки) — Cache First
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
