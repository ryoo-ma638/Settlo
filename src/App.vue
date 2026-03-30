<template>
  <div v-if="!authChecked" class="loading-screen">
    <p>Loading Settlo...</p>
  </div>

  <template v-else>
    <template v-if="route.path === '/login'">
      <main class="main-content">
        <RouterView />
      </main>
    </template>

    <div v-else-if="isDesktop" class="pc-layout">
      <aside class="pc-left-sidebar">
        <AppSidebar :isOpen="true" :isDesktop="true" />
      </aside>

      <div class="pc-center-main">
        <main class="pc-content-area">
          <RouterView />
        </main>
      </div>

      <aside class="pc-right-sidebar">
        <div class="notification-box">
          <NotificationIcon :isStatic="true" />
        </div>
      </aside>
    </div>

    <div v-else class="mobile-layout">
      <AppHeader />
      <main class="main-content">
        <RouterView />
      </main>
      <AppFooter />
    </div>
  </template>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "./firebase"
import { getMessaging, getToken } from "firebase/messaging"

// 🌟 1. コンポーネントのインポート
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import AppSidebar from './components/AppSidebar.vue'
import NotificationIcon from './components/NotificationIcon.vue'

const route = useRoute()
const router = useRouter()
const authChecked = ref(false)
const messaging = getMessaging()

// 🌟 2. 通知許可を求める関数
const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      console.log("通知の許可が得られました！")
      
      // ⚠️ ここに、Firebaseコンソールで取得した「VAPID鍵」を貼り付けてください！
      const token = await getToken(messaging, { 
        vapidKey: "BJ1ETrFo6dkYa-TueyQTYuSYQbRi0BD_UJmh2bRigKzzZnhHjU7bsUZgLWrPWvngVsN9iwWTz6yZczxkn53-0_c" 
      })
      
      console.log("あなたのデバイストークン:", token)
    } else {
      console.warn("通知が拒否されました")
    }
  } catch (err) {
    console.error("トークン取得中にエラー:", err)
  }
}

// 🖥 PCサイズ判定ロジック
const isDesktop = ref(window.innerWidth >= 1024)
const updateSize = () => {
  isDesktop.value = window.innerWidth >= 1024
}

// 🌟 3. 起動時の処理を1つの onMounted にまとめました
onMounted(() => {
  // サイズ変更イベントの登録
  window.addEventListener('resize', updateSize)
  
  // Push通知の許可リクエスト
  requestNotificationPermission()
  
  // ログイン監視を開始
  onAuthStateChanged(auth, (user) => {
    authChecked.value = true
    
    if (user) {
      console.log("Settlo ログイン中:", user.uid)
      if (route.path === "/login") {
        router.push("/mypage")
      }
    } else {
      console.log("未ログイン")
      if (route.path !== "/login" && route.path !== "/signup") {
        router.push("/login")
      }
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})
</script>

<style>
/* 全体共通 */
body {
  margin: 0;
  padding: 0;
  background-color: #f0f4f8; 
  font-family: sans-serif;
  overflow-x: hidden;
}

#app {
  max-width: 100% !important;
  width: 100%;
  padding: 0 !important;
}

/* ローディング画面 */
.loading-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-weight: bold;
  color: #1e293b;
}

/* --- 📱 スマホ版 --- */
.mobile-layout .main-content {
  padding-bottom: 100px;
}

/* --- 💻 PC版（3カラム） --- */
.pc-layout {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background-color: #e2e8f0;
}

.pc-left-sidebar {
  width: 280px;
  flex-shrink: 0;
  background-color: #1e293b;
  position: sticky;
  top: 0;
  height: 100vh;
}

.pc-center-main {
  flex: 1;
  min-width: 0; 
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  box-shadow: none; 
}

.pc-content-area {
  flex: 1;
  padding: 0; 
  display: flex;
  flex-direction: column;
}

.pc-right-sidebar {
  width: 300px;
  flex-shrink: 0;
  background-color: #ffffff;
  border-left: 1px solid #cbd5e1;
  position: sticky;
  top: 0;
  height: 100vh;
}

.notification-box {
  padding: 0; 
  height: 100vh;
  overflow: hidden;
}
</style>