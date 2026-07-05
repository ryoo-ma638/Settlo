// public/firebase-messaging-sw.js
// バックグラウンド（アプリを閉じている時）のプッシュ通知を受け取る Service Worker
// ※ ここにあるのは Firebase の「Web公開キー」で、公開されても安全な値のみ（秘密鍵ではない）
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDkvt2jFtT1qw8VpQHzf9_LbN4rpxPgBJs",
  authDomain: "pairpay-4c17a.firebaseapp.com",
  projectId: "pairpay-4c17a",
  storageBucket: "pairpay-4c17a.firebasestorage.app",
  messagingSenderId: "709008640085",
  appId: "1:709008640085:web:b0113f2547d4abb6fd6cdc"
});

const messaging = firebase.messaging();

// バックグラウンドで通知を受け取った時の表示
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Settlo';
  const body = payload.notification?.body || payload.data?.body || '新しいお知らせがあります';
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || 'settlo-notification',
  });
});

// 通知をタップしたらアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
