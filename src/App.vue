<template>
  <div v-if="!authChecked" class="app-loading">
    <img class="app-loading__mark" :src="logoMark" alt="" aria-hidden="true">
    <p class="app-loading__text">Settlo を読み込み中…</p>
  </div>

  <template v-else>
    <!-- ログイン・チャットはシェル無しで全画面（LINE風にチャットへ集中） -->
    <RouterView v-if="route.path === '/login' || route.path.startsWith('/thread')" />

    <!-- ゲスト入場の直後：デモデータが届くまでホームを描かない（空っぽの ¥0 画面を見せない） -->
    <div v-else-if="preparingGuestDemo" class="app-loading">
      <img class="app-loading__mark" :src="logoMark" alt="" aria-hidden="true">
      <p class="app-loading__text">デモデータを用意しています…</p>
      <div class="skeleton skeleton--text app-loading__bar"></div>
    </div>

    <!-- それ以外は共通のモバイルシェル -->
    <div v-else class="app-shell">
      <AppHeader />
      <main class="app-main">
        <RouterView />
      </main>
      <AppFooter />
      <OnboardingModal />
      <ButtonTour />
      <GlobalToast />
    </div>
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "./firebase"
import { doc, setDoc, arrayUnion } from "firebase/firestore"
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging"

import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import OnboardingModal from './components/OnboardingModal.vue'
import ButtonTour from './components/ButtonTour.vue'
import GlobalToast from './components/GlobalToast.vue'
import { useGuestSetup } from './composables/useGuestSetup'
import logoMark from './assets/logo-mark.png'

const route = useRoute()
const router = useRouter()
const authChecked = ref(false)
// ゲストのデモデータ準備中は、ホームの代わりに読込画面を出す
const { preparingGuestDemo } = useGuestSetup()

// 🌟 プッシュ通知のセットアップ（ログイン後に実行・トークンを保存して実配信できるように）
//    VAPIDキーは「公開鍵」なので埋め込みOK
const VAPID_KEY = "BJ1ETrFo6dkYa-TueyQTYuSYQbRi0BD_UJmh2bRigKzzZnhHjU7bsUZgLWrPWvngVsN9iwWTz6yZczxkn53-0_c"

const setupPushNotifications = async (uid) => {
  try {
    if (!(await isSupported())) return // 非対応ブラウザ（iOS Safari の非PWA等）は静かにスキップ
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return

    const messaging = getMessaging()
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return

    // トークンを自分のユーザードキュメントに保存（複数端末に対応するため配列）
    await setDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) }, { merge: true })

    // アプリを開いている間に届いた通知はブラウザ通知で表示
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || "Settlo"
      const body = payload.notification?.body || payload.data?.body || "新しいお知らせがあります"
      try { new Notification(title, { body, icon: "/favicon.ico" }) } catch (e) {}
    })
  } catch (err) {
    console.error("プッシュ通知のセットアップに失敗:", err)
  }
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    authChecked.value = true
    if (user) {
      console.log("Settlo ログイン中:", user.uid)
      setupPushNotifications(user.uid) // ログインしてから通知の許可を求める
      if (route.path === "/login") {
        router.push("/")
      }
    } else {
      if (route.path !== "/login" && route.path !== "/signup") {
        router.push("/login")
      }
    }
  })
})
</script>

<style scoped>
/* ローディング */
.app-loading {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: var(--c-surface);
}
.app-loading__mark {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 10px 24px rgba(5, 150, 105, 0.3));
}
.app-loading__text {
  font-size: 13px;
  font-weight: var(--fw-medium);
  color: var(--c-text-sub);
}
/* 準備中であることが伝わるよう、読込スケルトンの帯を1本だけ添える */
.app-loading__bar {
  width: 180px;
  height: 8px;
  border-radius: 999px;
}

/* シェル */
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
}
.app-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
