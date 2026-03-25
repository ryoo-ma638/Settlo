<template>
  <AppHeader />
  
  <main class="main-content">
    <RouterView />
  </main>

  <AppFooter />
</template>

<script setup>
// 部品を読み込む
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
</script>

<style>
/* アプリ全体の共通設定 */
body {
  margin: 0;
  padding: 0;
  background-color: #f0f4f8; /* 松岡さん指定の背景色 */
  font-family: sans-serif;
}
.main-content {
  /* フッターに文字が隠れないように、下部に余白を空ける */
  padding-bottom: 100px;
}
</style>