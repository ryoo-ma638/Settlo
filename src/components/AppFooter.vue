<template>
  <nav class="botnav">
    <button class="botnav__tab" data-tour="nav-home" :class="{ 'is-active': isActive('/') }" @click="go('/')">
      <svg viewBox="0 0 24 24" class="botnav__icon"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 8.8V21h14V8.8"/></svg>
      <span>ホーム</span>
    </button>

    <button class="botnav__tab" data-tour="nav-event" :class="{ 'is-active': isActive('/event') }" @click="go('/event')">
      <span class="botnav__ico-wrap">
        <svg viewBox="0 0 24 24" class="botnav__icon"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>
        <NotifBadge :count="counts.event" />
      </span>
      <span>イベント</span>
    </button>

    <button class="botnav__fab" data-tour="nav-add" @click="showAddSheet = true" aria-label="追加">
      <svg viewBox="0 0 24 24" class="botnav__fab-icon"><path d="M12 6v12M6 12h12"/></svg>
    </button>

    <!-- ＋ の選択シート：イベント作成 / お支払い追加 -->
    <Teleport to="body">
      <transition name="sheet-fade">
        <div v-if="showAddSheet" class="addsheet" @click.self="showAddSheet = false">
          <div class="addsheet__panel">
            <button class="addsheet__item" data-tour="sheet-event" @click="pick('/make-event')">
              <span class="addsheet__ic addsheet__ic--brand">
                <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>
              </span>
              <span class="addsheet__txt">
                <b>イベントを作成</b>
                <small>旅行・飲み会などをつくる</small>
              </span>
            </button>
            <button class="addsheet__item" data-tour="sheet-payment" @click="pick('/event?pick=payment')">
              <span class="addsheet__ic addsheet__ic--pay">
                <svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/></svg>
              </span>
              <span class="addsheet__txt">
                <b>お支払いを追加</b>
                <small>イベントを選んで立て替えを記録</small>
              </span>
            </button>
            <button class="addsheet__cancel" data-tour="sheet-cancel" @click="showAddSheet = false">キャンセル</button>
          </div>
        </div>
      </transition>
    </Teleport>

    <button class="botnav__tab" data-tour="nav-money" :class="{ 'is-active': isActive('/payment') }" @click="go('/payment')">
      <span class="botnav__ico-wrap">
        <svg viewBox="0 0 24 24" class="botnav__icon"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/></svg>
        <NotifBadge :count="counts.payment" />
      </span>
      <span>支払い</span>
    </button>

    <button class="botnav__tab" data-tour="nav-friend" :class="{ 'is-active': isActive('/friend') }" @click="go('/friend')">
      <span class="botnav__ico-wrap">
        <svg viewBox="0 0 24 24" class="botnav__icon"><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20v-1.2A4.3 4.3 0 0 1 7.8 14.5h2.4a4.3 4.3 0 0 1 4.3 4.3V20"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.4M17.4 14.6a4.3 4.3 0 0 1 3.1 4.2V20"/></svg>
        <NotifBadge :count="counts.friend" />
      </span>
      <span>フレンド</span>
    </button>
  </nav>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import NotifBadge from './NotifBadge.vue';
import { useNotificationCounts } from '../composables/useNotificationCounts';

const route = useRoute();
const router = useRouter();
const showAddSheet = ref(false);

// フレンド/支払い/イベントの未読件数（リアルタイム）を下ナビのバッジに出す
const { counts } = useNotificationCounts();

const go = (path) => { if (route.path !== path) router.push(path); };
// 選択シートから遷移（クエリ付きも確実に飛べるよう router.push を使う）
const pick = (path) => { showAddSheet.value = false; router.push(path); };

const isActive = (path) => {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
};
</script>

<style scoped>
.botnav {
  flex-shrink: 0;
  /* ⚠️ iPhoneのホームバー余白（safe-area）は高さに「足す」こと。
     66pxの内側に食い込ませるとタブが半分に潰れて見える（実際に起きた） */
  height: calc(var(--nav-h) + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: stretch;
  background: var(--c-surface);
  border-top: 1px solid var(--c-line);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.botnav__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-top: 2px;
  color: var(--c-text-faint);
  font-size: 11px;
  font-weight: var(--fw-medium);
  transition: color 0.15s ease;
}
.botnav__tab.is-active { color: var(--c-brand); font-weight: var(--fw-bold); }

/* アイコンを基準にバッジを右上へ重ねるためのラッパー */
.botnav__ico-wrap {
  position: relative;
  display: inline-flex;
}
/* アイコンを隠さないよう、少し外側の右上へ出す */
.botnav__ico-wrap :deep(.notif-badge) {
  top: -5px;
  right: -8px;
}

.botnav__icon {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.9;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 中央の新規作成ボタン（FAB） */
.botnav__fab {
  flex: 0 0 auto;
  align-self: center;
  width: 54px;
  height: 54px;
  margin: 0 6px;
  border-radius: 50%;
  background: var(--c-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translateY(-14px);
  box-shadow: 0 8px 18px rgba(5, 150, 105, 0.4);
  transition: transform 0.12s ease, background-color 0.2s ease;
}
.botnav__fab:active { transform: translateY(-14px) scale(0.93); background: var(--c-brand-strong); }
.botnav__fab-icon {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.4;
  stroke-linecap: round;
}

/* ＋ の選択シート */
.addsheet {
  position: fixed; inset: 0; z-index: 3000;
  background: var(--c-overlay, rgba(15, 23, 42, 0.5));
  display: flex; align-items: flex-end; justify-content: center;
  padding: 16px;
}
.addsheet__panel {
  width: 100%; max-width: var(--app-max, 480px);
  background: var(--c-surface); border-radius: 22px;
  padding: 10px; margin-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--shadow-pop);
}
.addsheet__item {
  width: 100%; display: flex; align-items: center; gap: 14px;
  padding: 16px 14px; border-radius: 16px; text-align: left;
}
.addsheet__item:active { background: var(--c-surface-2); }
.addsheet__ic {
  width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.addsheet__ic svg { width: 24px; height: 24px; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.addsheet__ic--brand { background: var(--c-brand-weak); }
.addsheet__ic--brand svg { stroke: var(--c-brand); }
.addsheet__ic--pay { background: var(--c-pay-weak, #fff7ed); }
.addsheet__ic--pay svg { stroke: var(--c-pay-strong); }
.addsheet__txt { display: flex; flex-direction: column; gap: 2px; }
.addsheet__txt b { font-size: 15px; font-weight: var(--fw-black); color: var(--c-ink); }
.addsheet__txt small { font-size: 12px; color: var(--c-text-sub); }
.addsheet__cancel {
  width: 100%; padding: 14px; margin-top: 4px;
  font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text-sub);
  border-radius: 14px;
}
.addsheet__cancel:active { background: var(--c-surface-2); }

.sheet-fade-enter-active, .sheet-fade-leave-active { transition: opacity 0.2s ease; }
.sheet-fade-enter-from, .sheet-fade-leave-to { opacity: 0; }
</style>
