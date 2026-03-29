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

    if (router.currentRoute.value.path === "/login") {
      router.push("/mypage");
    }

  } else {
    console.log("未ログイン");

    if (router.currentRoute.value.path !== "/login") {
      router.push("/login");
    }
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
  overflow-x: hidden; /* 🌟 追加：画面全体が横にブレるのを強制的に防ぐ */
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
  background-color: #1e293b;
  

  position: sticky;
  top: 0;
  height: 100vh;
}

/* 中央カラム */
.pc-center-main {
  flex: 1;
  min-width: 0; 
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  /* 🌟 修正：影を消して、左右のカラムと完全にフラットに繋げる */
  box-shadow: none; 
}

.pc-content-area {
  flex: 1;
  /* 🌟 修正：30pxあった上下左右の余白を 0 にして隙間をなくす */
  padding: 0; 
  
  display: flex;
  flex-direction: column;
}
.pc-content-area > * {
  flex: 1; /* これでどのページも自動的に一番下まで伸びます！ */
}

/* --- App.vue の <style> の最後の方 --- */

/* 右カラム */
.pc-right-sidebar {
  width: 300px;
  flex-shrink: 0;
  background-color: #ffffff;
  border-left: 1px solid #cbd5e1;
  
  position: sticky;
  top: 0;
  height: 100vh; /* 画面全体の高さにする */
}

.notification-box {
  padding: 0; 
  height: 100vh;
  overflow: hidden; /* 二重スクロールを防ぐ */
}
</style>