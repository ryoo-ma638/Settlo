<template>
  <nav class="botnav">
    <button class="botnav__tab" :class="{ 'is-active': isActive('/') }" @click="go('/')">
      <svg viewBox="0 0 24 24" class="botnav__icon"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 8.8V21h14V8.8"/></svg>
      <span>ホーム</span>
    </button>

    <button class="botnav__tab" :class="{ 'is-active': isActive('/event') }" @click="go('/event')">
      <svg viewBox="0 0 24 24" class="botnav__icon"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>
      <span>イベント</span>
    </button>

    <button class="botnav__fab" @click="go('/make-event')" aria-label="新規イベント作成">
      <svg viewBox="0 0 24 24" class="botnav__fab-icon"><path d="M12 6v12M6 12h12"/></svg>
    </button>

    <button class="botnav__tab" :class="{ 'is-active': isActive('/payment') }" @click="go('/payment')">
      <svg viewBox="0 0 24 24" class="botnav__icon"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/></svg>
      <span>支払い</span>
    </button>

    <button class="botnav__tab" :class="{ 'is-active': isActive('/friend') }" @click="go('/friend')">
      <svg viewBox="0 0 24 24" class="botnav__icon"><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20v-1.2A4.3 4.3 0 0 1 7.8 14.5h2.4a4.3 4.3 0 0 1 4.3 4.3V20"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.4M17.4 14.6a4.3 4.3 0 0 1 3.1 4.2V20"/></svg>
      <span>フレンド</span>
    </button>
  </nav>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const go = (path) => { if (route.path !== path) router.push(path); };

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
</style>
