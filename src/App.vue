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
      <main class="app-main" ref="appMain">
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
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "./firebase"

import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import OnboardingModal from './components/OnboardingModal.vue'
import ButtonTour from './components/ButtonTour.vue'
import GlobalToast from './components/GlobalToast.vue'
import { useGuestSetup } from './composables/useGuestSetup'
import logoMark from './assets/logo-mark.png'
import { refreshPushRegistration, listenForForegroundPush } from './lib/notificationSettings'

const route = useRoute()
const router = useRouter()
// 🌟 画面を切り替えたら、中身のスクロールを先頭へ戻す。
//    スクロールしているのは window ではなく .app-main（overflow-y: auto）なので、
//    ルーターの scrollBehavior では動かない。ここで直接戻す。
//    下までスクロールした状態で別の画面へ移ると、そのまま下に着地して
//    上部のタブやボタンが画面外になっていた。
//    クエリだけの変化（?addPayment=1 などモーダルの開閉）では戻さない。
const appMain = ref(null)
watch(() => route.path, () => { appMain.value?.scrollTo({ top: 0 }) })

const authChecked = ref(false)
// ゲストのデモデータ準備中は、ホームの代わりに読込画面を出す
const { preparingGuestDemo } = useGuestSetup()

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    authChecked.value = true
    if (user) {
      console.log("Settlo ログイン中:", user.uid)
      // 許可画面は通知設定のボタン操作時だけ出す。既に許可済みの端末は登録を更新する。
      refreshPushRegistration(user.uid).then(() => listenForForegroundPush()).catch((err) => {
        console.error("プッシュ通知の登録更新に失敗:", err)
      })
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
