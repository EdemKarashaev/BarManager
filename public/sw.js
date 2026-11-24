const CACHE_NAME = 'bar-manager-shell-v1';
const BUILD_FILES = 'BM_OFFLINE_FILES_PLACEHOLDER';
const SHELL_FILES = Array.isArray(BUILD_FILES)
  ? BUILD_FILES
  : [];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_FILES)
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith('bar-manager-shell-') &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Version checks must always use the network.
  if (url.pathname === '/version.json') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const path = url.pathname.replace(/\/$/, '') || '/';

          const candidates = [
            request,
            path,
            path + '.html',
            path + '/index.html',
          ];

          if (/^\/recipes\/\d+$/.test(path)) {
            candidates.push('/recipes/[id].html');
          }

          candidates.push('/');

          for (const candidate of candidates) {
            const cached = await cache.match(candidate, {
              ignoreSearch: true,
            });

            if (cached) return cached;
          }

          return new Response(
            'Нет подключения к интернету.',
            { status: 503 }
          );
        })
    );

    return;
  }

  if (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    SHELL_FILES.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(async cached => {
        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      })
    );
  }
});
