// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 🌟 ここに、Firebaseコンソールの「全般」タブにある「マイアプリ」の構成情報を入れてください
firebase.initializeApp({
  apiKey: "あなたのAPIキー",
  authDomain: "あなたのプロジェクトID.firebaseapp.com",
  projectId: "あなたのプロジェクトID",
  storageBucket: "あなたのプロジェクトID.appspot.com",
  messagingSenderId: "あなたの送信者ID",
  appId: "あなたのアプリID"
});

const messaging = firebase.messaging();

// 通知を受け取った時の動き（バックグラウンド）
messaging.onBackgroundMessage((payload) => {
  console.log('通知を受け取りました:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/img/icons/favicon-32x32.png' // アイコンがあれば
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});