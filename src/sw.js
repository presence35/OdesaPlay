import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const { title, body, icon, tag, url } = data;
  const options = {
    body,
    icon: icon || '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: tag || 'odesa-alert',
    data: { url: url || '/' },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const urlToOpen = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen) return client.focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
