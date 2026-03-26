<template>
  <template v-if="$route.path === '/login'">
    <main class="main-content">
      <RouterView />
    </main>
  </template>

  <div v-else-if="isDesktop" class="pc-layout">
    
    <aside class="pc-left-sidebar">
      <AppSidebar :isOpen="true" />
    </aside>

    <div class="pc-center-main">
      <main class="pc-content-area">
        <RouterView />
      </main>
      <AppFooter />
    </div>

    <aside class="pc-right-sidebar">
      <div class="notification-box">
        <h3>🔔 お知らせ</h3>
        <p>新しいイベントが作成されました</p>
        <p>〇〇さんからフレンド申請が届いています</p>
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

const route = useRoute()

// 🌟1024px以上かどうかを判定
const isDesktop = ref(window.innerWidth >= 1024)
const updateSize = () => {
  isDesktop.value = window.innerWidth >= 10224
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

/* --- 📱 スマホ版用のスタイル --- */
.mobile-layout .main-content {
  padding-bottom: 0;
}
body:not(:has(.login-container)) .mobile-layout .main-content {
  padding-bottom: 100px; /* AppFooterの高さ分 */
}

/* --- 💻 PC版用のスタイル（3カラム） --- */
.pc-layout {
  display: flex; /* 横に並べる */
  width: 100%;
  min-height: 100vh;
  background-color: #e2e8f0; /* 全体の背景を少し暗く */
}

/* 左カラム */
.pc-left-sidebar {
  width: 280px; /* 左メニューの固定幅 */
  flex-shrink: 0; /* 縮まないようにする */
}

/* 中央カラム */
.pc-center-main {
  flex: 1; /* 余った幅をすべて使う */
  display: flex;
  flex-direction: column; /* 縦に並べる（メイン→フッター） */
  max-width: 800px; /* 画面が広すぎても間延びしないように最大幅を設定 */
  margin: 0 auto; /* 中央に寄せる */
  background-color: #ffffff;
  box-shadow: 0 0 15px rgba(0,0,0,0.05); /* うっすら影をつける */
}
.pc-content-area {
  flex: 1; /* コンテンツが短い時でも、フッターを一番下に押しやる */
  padding: 30px;
}

/* 右カラム */
.pc-right-sidebar {
  width: 300px; /* 右お知らせの固定幅 */
  flex-shrink: 0;
  background-color: #ffffff;
  border-left: 1px solid #cbd5e1;
}

/* 右カラムの中身（スクロールしても追従させる） */
.notification-box {
  padding: 20px;
  position: sticky;
  top: 0;
}
</style>