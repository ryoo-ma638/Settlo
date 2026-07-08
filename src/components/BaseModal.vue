<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-container" role="dialog" aria-modal="true">

          <div class="icon-area" :class="type">
            <svg viewBox="0 0 24 24">
              <path v-if="type === 'success'" d="M5 13l4 4L19 7" />
              <path v-else-if="type === 'error'" d="M6 6l12 12M18 6L6 18" />
              <template v-else-if="type === 'warning'">
                <path d="M12 4l9 16H3z" />
                <path d="M12 10v4M12 16.5h.01" />
              </template>
              <template v-else>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </template>
            </svg>
          </div>

          <div class="text-area">
            <h3 class="modal-title">{{ title }}</h3>
            <p class="modal-message">{{ message }}</p>
          </div>

          <div class="button-area">
            <button v-if="showCancel" class="btn-cancel" @click="cancel">{{ cancelText }}</button>
            <button class="btn-confirm" :class="type" @click="confirm">{{ confirmText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  show: Boolean,
  type: { type: String, default: 'info' }, // success, error, warning, info
  title: String,
  message: String,
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'キャンセル' },
  showCancel: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'confirm', 'cancel']);

const close = () => emit('close');
const confirm = () => { emit('confirm'); close(); };
const cancel = () => { emit('cancel'); close(); };
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999 !important;
  padding: 20px;
}

.modal-container {
  background: var(--c-surface);
  width: 100%;
  max-width: 320px;
  border-radius: var(--r-xl);
  padding: 26px 24px 22px;
  box-shadow: var(--shadow-pop);
  text-align: center;
}

/* アイコン */
.icon-area {
  width: 64px; height: 64px;
  border-radius: 50%;
  display: flex; justify-content: center; align-items: center;
  margin: 0 auto 16px;
}
.icon-area svg {
  width: 32px; height: 32px;
  fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round;
}
.icon-area.success { background: var(--c-brand-weak); }
.icon-area.success svg { stroke: var(--c-brand); }
.icon-area.error { background: var(--c-danger-weak); }
.icon-area.error svg { stroke: var(--c-danger); }
.icon-area.warning { background: #fffbeb; }
.icon-area.warning svg { stroke: var(--c-pay); }
.icon-area.info { background: var(--c-brand-weak); }
.icon-area.info svg { stroke: var(--c-brand); }

/* テキスト */
.modal-title { font-size: 18px; font-weight: var(--fw-bold); color: var(--c-ink); margin-bottom: 8px; white-space: pre-line; }
.modal-message { font-size: 14px; color: var(--c-text-sub); margin-bottom: 22px; line-height: 1.6; white-space: pre-line; }

/* ボタン */
.button-area { display: flex; gap: 10px; }
.btn-confirm, .btn-cancel {
  flex: 1; padding: 13px; border-radius: var(--r-md);
  font-weight: var(--fw-bold); font-size: 15px; transition: transform 0.12s ease;
}
.btn-confirm:active, .btn-cancel:active { transform: scale(0.97); }

.btn-cancel { background: var(--c-surface-2); color: var(--c-text-sub); }

.btn-confirm { color: #fff; }
.btn-confirm.success { background: var(--c-brand); }
.btn-confirm.error { background: var(--c-danger); }
.btn-confirm.warning { background: var(--c-pay); }
.btn-confirm.info { background: var(--c-brand); }

/* アニメーション */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal-container { animation: slide-in 0.25s ease; }

@keyframes slide-in {
  0% { transform: translateY(16px) scale(0.96); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
</style>
