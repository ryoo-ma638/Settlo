<template>
  <Teleport to="body">
    <transition name="toast">
      <div v-if="toastMsg" class="gtoast" role="status" aria-live="polite">{{ toastMsg }}</div>
    </transition>
  </Teleport>
</template>

<script setup>
import { toastMsg } from '../lib/toast';
</script>

<style scoped>
.gtoast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h, 66px) + env(safe-area-inset-bottom, 0px) + 16px);
  transform: translateX(-50%);
  max-width: min(92%, 440px);
  background: var(--c-ink, #0f172a);
  color: #fff;
  font-size: 13.5px;
  font-weight: var(--fw-bold, 700);
  line-height: 1.5;
  padding: 11px 18px;
  border-radius: var(--r-pill, 999px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  z-index: 5000;
  text-align: center;
  white-space: pre-line;
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
