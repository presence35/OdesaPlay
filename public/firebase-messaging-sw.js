importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAQzdrrYLojnLm3s9pVnfaAyShvr2BNMrI',
  authDomain: 'gen-lang-client-0165483160.firebaseapp.com',
  projectId: 'gen-lang-client-0165483160',
  storageBucket: 'gen-lang-client-0165483160.firebasestorage.app',
  messagingSenderId: '1045745050915',
  appId: '1:1045745050915:web:7f492ef48cdbe9c9861896',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = notification.title || data.title || 'ODESA ГРА';
  const options = {
    body: notification.body || data.body || '',
    icon: data.icon || '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: data.tag || 'odesa-alert',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
  };
  self.registration.showNotification(title, options);
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
