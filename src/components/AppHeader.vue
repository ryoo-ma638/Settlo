<template>
  <header class="topbar">
    <div class="topbar__left">
      <button class="topbar__avatar" data-tour="avatar" @click="navigate('/mypage')" aria-label="マイページ">
        <img v-if="userPhoto" :src="userPhoto" alt="" />
        <span v-else class="topbar__avatar-fallback">{{ initial }}</span>
      </button>
      <button class="topbar__pending" data-tour="pending" @click="navigate('/approvals')" aria-label="承認待ち">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        <span v-if="pendingCount > 0" class="topbar__pending-badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
      </button>
      <button class="topbar__chat" data-tour="chat" @click="navigate('/chats')" aria-label="チャット">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/>
        </svg>
        <span v-if="chatUnread > 0" class="topbar__chat-badge">{{ chatUnread > 99 ? '99+' : chatUnread }}</span>
      </button>
    </div>

    <h1 class="topbar__brand" @click="navigate('/')">Settlo</h1>

    <div class="topbar__right">
      <NotificationIcon ref="notifRef" />
      <button class="topbar__assist" :class="{ 'is-open': showAssistant }" data-tour="assist" @click="showAssistant = !showAssistant" aria-label="お支払いアシスタント">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M8 3h8"/>
          <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none"/>
        </svg>
        <span v-if="guideActions.length > 0" class="topbar__assist-badge">{{ guideActions.length > 99 ? '99+' : guideActions.length }}</span>
      </button>
    </div>
  </header>

  <!-- お支払いアシスタント：ヘッダーのアイコンから開閉。全ページで開ける。 -->
  <Teleport to="body">
    <transition name="assist">
      <div v-if="showAssistant" class="assist-layer" @click.self="showAssistant = false">
        <div class="assist-panel">
          <button class="assist-panel__close" @click="showAssistant = false" aria-label="閉じる">×</button>
          <ActionGuide :actions="guideActions" @navigate="showAssistant = false" />
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import NotificationIcon from './NotificationIcon.vue';
import ActionGuide from './ActionGuide.vue';
import { useGuideActions } from '../composables/useGuideActions';
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

const router = useRouter();
const route = useRoute();
const notifRef = ref(null);
const userName = ref("");
const userPhoto = ref("");
const chatUnread = ref(0); // チャットの合計未読件数
const pendingCount = ref(0); // 承認待ち（自分が承認する側）の件数

// お支払いアシスタント（全ページ共通・アイコンから開閉）
const { actions: guideActions } = useGuideActions();
const showAssistant = ref(false);
// ページを移動したらパネルは自動で閉じる
watch(() => route.fullPath, () => { showAssistant.value = false; });

const initial = computed(() => (userName.value || "U").trim().charAt(0).toUpperCase());

const navigate = (path) => { router.push(path); };

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          userName.value = data.name || user.displayName || "";
          userPhoto.value = data.photo || user.photoURL || "";
        }
      });
      // チャットの合計未読件数を購読
      const tq = query(collection(db, "threads"), where("participants", "array-contains", user.uid));
      onSnapshot(tq, (snap) => {
        let n = 0;
        snap.docs.forEach((d) => {
          const t = d.data();
          if ((t.hiddenBy || []).includes(user.uid)) return; // 片付け済み＝一覧に無いので数えない
          n += (t.unread && t.unread[user.uid]) || 0;
        });
        chatUnread.value = n;
      }, () => {});
      // 承認待ち（自分が受け取る側で、相手が「支払った」と申請中＝自分の承認待ち）
      const pq = query(collection(db, "transactions"), where("paidToId", "==", user.uid));
      onSnapshot(pq, (snap) => {
        pendingCount.value = snap.docs.filter((d) => d.data().status === "awaiting_approval").length;
      }, () => {});
    }
  });
});
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  height: var(--header-h);
  display: flex;                     /* 左＝アバター＋ロゴ / 右＝アイコン群 を両端に */
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-line);
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.topbar__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--c-brand-tint);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease;
}
.topbar__avatar:active { transform: scale(0.92); }
.topbar__avatar img { width: 100%; height: 100%; object-fit: cover; }
.topbar__avatar-fallback {
  font-size: 15px;
  font-weight: var(--fw-bold);
  color: var(--c-brand-strong);
}

.topbar__brand {
  /* ロゴは画面中央に固定（左＝アバター＋承認待ち＋チャット / 右＝お知らせ＋アシスタント）。 */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  font-weight: var(--fw-black);
  letter-spacing: 0.02em;
  color: var(--c-brand-strong);
  cursor: pointer;
  white-space: nowrap;
}

.topbar__right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0;
}

.topbar__chat, .topbar__pending, .topbar__assist {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  color: var(--c-text-sub);
  background: none; border: none;
  border-radius: 50%;
}
.topbar__chat:active, .topbar__pending:active, .topbar__assist:active { background: var(--c-surface-2); transform: scale(0.94); }
.topbar__chat, .topbar__pending, .topbar__assist { position: relative; }
.topbar__chat-badge, .topbar__pending-badge, .topbar__assist-badge {
  position: absolute; top: 0; right: 0;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 10px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
}
.topbar__pending-badge { background: var(--c-pay-strong); }
.topbar__assist-badge { background: var(--c-brand); }
/* 開いている間はアイコンをブランド色で強調 */
.topbar__assist.is-open { color: var(--c-brand-strong); background: var(--c-brand-weak); }

/* お支払いアシスタントの開閉パネル（body直下・全ページ共通） */
.assist-layer {
  position: fixed;
  left: 0; right: 0; top: var(--header-h); bottom: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.14);
}
.assist-panel {
  position: absolute;
  top: 6px; right: 8px;
  width: min(360px, calc(100vw - 16px));
  max-height: calc(100vh - var(--header-h) - 16px);
  overflow-y: auto;
}
/* パネル内のカードは自前で余白を持たせる（ホーム時のmarginを打ち消す） */
.assist-panel :deep(.guide) { margin: 0; }
.assist-panel__close {
  position: absolute;
  top: 6px; right: 8px;
  width: 30px; height: 30px;
  z-index: 1;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: var(--c-surface-2); color: var(--c-text-sub);
  font-size: 20px; line-height: 1;
}
.assist-panel__close:active { transform: scale(0.9); }

.assist-enter-active, .assist-leave-active { transition: opacity 0.16s ease; }
.assist-enter-from, .assist-leave-to { opacity: 0; }
.assist-enter-active .assist-panel, .assist-leave-active .assist-panel { transition: transform 0.16s ease; }
.assist-enter-from .assist-panel, .assist-leave-to .assist-panel { transform: translateY(-8px); }
</style>
