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
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import AppSidebar from './components/AppSidebar.vue'

// 🌟 NotificationView ではなく NotificationIcon をインポート
import NotificationIcon from './components/NotificationIcon.vue'

const route = useRoute()

// 🌟PCサイズの判定
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
</script>

<style>
/* 全体共通 */
body {
  margin: 0;
  padding: 0;
  background-color: #f0f4f8; 
  font-family: sans-serif;
}
/* 🌟 ここを追加！：Vue(Vite)が裏で勝手にかけている「最大幅1280px」の制限を強制解除する */
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

.mobile-notification-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: #ffffff;
  z-index: 3000;
  overflow-y: auto;
  padding-top: 75px;
}

.close-notification-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

/* --- 💻 PC版用のスタイル（3カラム） --- */
.pc-layout {
  display: flex; /* 🌟 左・中央・右を横並びにする魔法 */
  width: 100%;
  min-height: 100vh;
  background-color: #e2e8f0;
}

/* 左カラム */
.pc-left-sidebar {
  width: 280px; /* 固定幅 */
  flex-shrink: 0;
}

/* 中央カラム */
.pc-center-main {
  flex: 1; /* 🌟 左右のサイドバー以外の「余った空間すべて」を使い切る設定 */
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  box-shadow: 0 0 15px rgba(0,0,0,0.05);
  /* ❌ max-widthやmargin: 0 auto; は中央を狭くするので書きません！ */
}
.pc-content-area {
  flex: 1;
  padding: 30px;
  
  /* 🌟 追加：RouterViewの中身（各ページ）を中央に配置する */
  display: flex;
  justify-content: center; /* 横方向の中央寄せ */
  align-items: flex-start; /* 縦方向は上揃え */
}

/* 🌟 追加：各ページ（PaymentViewなど）の幅を制限して間延びを防ぐ */
.pc-content-area > * {
  width: 100%;
  max-width: 600px; /* ここで中央コンテンツの横幅を決めます（好みに応じて800pxなどに変更可） */
}

/* 右カラム */
.pc-right-sidebar {
  width: 300px; /* 固定幅 */
  flex-shrink: 0;
  background-color: #ffffff;
  border-left: 1px solid #cbd5e1;
}

/* 右カラムの中身 */
.notification-box {
  padding: 0; 
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
</style>