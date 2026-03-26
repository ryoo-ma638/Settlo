<template>
  <AppHeader v-if="$route.path !== '/login'" />
  
  <main class="main-content">
    <RouterView />
  </main>

  <AppFooter v-if="$route.path !== '/login'" />
</template>

<script setup>
// 🌟 ページ情報を取得するための機能をインポート
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

// 🌟 現在のルート（パス）を使えるようにする
const route = useRoute()

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { useRouter } from "vue-router";

const router = useRouter();

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
/* アプリ全体の共通設定 */
body {
  margin: 0;
  padding: 0;
  background-color: #f0f4f8; 
  font-family: sans-serif;
}

/* 🌟 ログイン画面のときは余白をなくす（三項演算子でスタイルを切り替え） */
.main-content {
  /* ログイン画面以外ならフッター分の余白、ログイン画面なら余白ゼロ */
  padding-bottom: 0;
}

/* ログイン画面以外の場合の余白設定（必要なら） */
body:not(:has(.login-container)) .main-content {
  padding-bottom: 100px;
}
</style>