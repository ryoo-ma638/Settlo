<template>
  <div v-if="!authChecked" class="app-loading">
    <div class="app-loading__mark">¥</div>
    <p class="app-loading__text">Settlo を読み込み中…</p>
  </div>

  <template v-else>
    <!-- ログインはシェル無しで全画面 -->
    <RouterView v-if="route.path === '/login'" />

    <!-- それ以外は共通のモバイルシェル -->
    <div v-else class="app-shell">
      <AppHeader />
      <main class="app-main">
        <RouterView />
      </main>
      <AppFooter />
    </div>
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "./firebase"
import { getMessaging, getToken } from "firebase/messaging"

import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

const route = useRoute()
const router = useRouter()
const authChecked = ref(false)
const messaging = getMessaging()

// Push通知の許可リクエスト（VAPIDは公開鍵）
const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: "BJ1ETrFo6dkYa-TueyQTYuSYQbRi0BD_UJmh2bRigKzzZnhHjU7bsUZgLWrPWvngVsN9iwWTz6yZczxkn53-0_c"
      })
      console.log("デバイストークン取得:", token)
    } else {
      console.warn("通知が拒否されました")
    }
  } catch (err) {
    console.error("トークン取得中にエラー:", err)
  }
}

onMounted(() => {
  requestNotificationPermission()

  onAuthStateChanged(auth, (user) => {
    authChecked.value = true
    if (user) {
      console.log("Settlo ログイン中:", user.uid)
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
  border-radius: 18px;
  background: var(--c-brand);
  color: #fff;
  font-size: 34px;
  font-weight: var(--fw-black);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(5, 150, 105, 0.3);
}
.app-loading__text {
  font-size: 13px;
  font-weight: var(--fw-medium);
  color: var(--c-text-sub);
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
