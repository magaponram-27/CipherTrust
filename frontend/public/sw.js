const CACHE_NAME = 'ciphertrust-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/manifest.json', '/icon.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
});
self.addEventListener('notificationclick', (event) => {
  const target = event.notification.data;
  event.notification.close();
  event.waitUntil((async () => {
    if (typeof target?.targetUsername !== 'string' ||
        typeof target?.username !== 'string' ||
        typeof target?.messageId !== 'string') return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginWindows = windows.filter((client) =>
      new URL(client.url).origin === self.location.origin
    );
    for (const client of sameOriginWindows) {
      client.postMessage({
      type: 'ciphertrust-open-message',
      username: target?.username,
      messageId: target?.messageId,
      targetUsername: target?.targetUsername
      });
    }
  })());
});
