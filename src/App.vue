<template>
  <template v-if="$route.path === '/login'">
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

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import AppSidebar from './components/AppSidebar.vue'
import NotificationIcon from './components/NotificationIcon.vue'

// 🌟 チームメンバーが追加したFirebaseのインポート
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const route = useRoute()
const router = useRouter()

// 🌟 大崎さんのPCサイズ判定ロジック
const isDesktop = ref(window.innerWidth >= 1024)
const updateSize = () => {
  isDesktop.value = window.innerWidth >= 1024
}

onMounted(() => {
  window.addEventListener('resize', updateSize)
})
onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})

// 🌟 チームメンバーが追加したログイン監視ロジック
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("ログイン中", user);
  } else {
    console.log("未ログイン");
    router.push("/login");
  }
});
</script>

<style>
/* 全体共通 */
body {
  margin: 0;
  padding: 0;
  background-color: #f0f4f8; 
  font-family: sans-serif;
}
#app {
  max-width: 100% !important;
  width: 100%;
  padding: 0 !important;
}

/* --- 📱 スマホ版用のスタイル --- */
.mobile-layout .main-content {
  padding-bottom: 0;
}
body:not(:has(.login-container)) .mobile-layout .main-content {
  padding-bottom: 100px;
}

/* --- 💻 PC版用のスタイル（3カラム） --- */
.pc-layout {
  display: flex;
  width: 100%;
  min-height: 100vh;
  background-color: #e2e8f0;
}

/* 左カラム */
.pc-left-sidebar {
  width: 280px;
  flex-shrink: 0;
}

/* 中央カラム */
.pc-center-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  box-shadow: 0 0 15px rgba(0,0,0,0.05);
}
.pc-content-area {
  flex: 1;
  padding: 30px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.pc-content-area > * {
  width: 100%;
  max-width: 600px;
}

/* 右カラム */
.pc-right-sidebar {
  width: 300px;
  flex-shrink: 0;
  background-color: #ffffff;
  border-left: 1px solid #cbd5e1;
}

.notification-box {
  padding: 0; 
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
</style>