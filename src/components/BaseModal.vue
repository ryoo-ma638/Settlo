<template>
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="show" class="modal-overlay" @click.self="close">
          <div class="modal-container" role="dialog" aria-modal="true">
            
            <div class="icon-area" :class="type">
              <span v-if="type === 'success'">✅</span>
              <span v-if="type === 'error'">❌</span>
              <span v-if="type === 'warning'">⚠️</span>
              <span v-if="type === 'info'">ℹ️</span>
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
  /* オーバーレイ（背景の暗がり） */
  /* オーバーレイ（背景の暗がり） */
.modal-overlay { 
  position: fixed; 
  top: 0; 
  left: 0; 
  width: 100%; 
  height: 100%; 
  background-color: rgba(0, 0, 0, 0.5); 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  
  /* 🌟 ここを最強の数字にして !important をつける */
  z-index: 99999 !important; 
  
  backdrop-filter: blur(4px); 
}
  
  /* モーダル本体（iOS風のクリーンなデザイン） */
  .modal-container { 
    background: white; width: 90%; max-width: 320px; 
    border-radius: 24px; padding: 24px; 
    box-shadow: 0 20px 60px rgba(0,0,0,0.2); 
    text-align: center; overflow: hidden; 
  }
  
  /* アイコン */
  .icon-area { font-size: 40px; margin-bottom: 16px; width: 80px; height: 80px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-left: auto; margin-right: auto; }
  .icon-area.success { background-color: #ecfdf5; color: #10b981; }
  .icon-area.error { background-color: #fef2f2; color: #ef4444; }
  .icon-area.warning { background-color: #fffbeb; color: #f59e0b; }
  .icon-area.info { background-color: #eff6ff; color: #3b82f6; }
  
  /* テキスト */
  .modal-title { font-size: 18px; font-weight: 800; color: #1e293b; margin: 0 0 8px 0; white-space: pre-line; }
  .modal-message { font-size: 14px; color: #64748b; margin: 0 0 24px 0; line-height: 1.5; white-space: pre-line; }
  
  /* ボタン */
  .button-area { display: flex; gap: 12px; justify-content: center; }
  .btn-confirm, .btn-cancel { flex: 1; padding: 12px; border-radius: 14px; border: none; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; }
  .btn-confirm:active, .btn-cancel:active { transform: scale(0.95); }
  
  .btn-cancel { background-color: #f1f5f9; color: #64748b; }
  
  .btn-confirm.success { background-color: #10b981; color: white; }
  .btn-confirm.error { background-color: #ef4444; color: white; }
  .btn-confirm.info, .btn-confirm.warning { background-color: #1e293b; color: white; }
  
  /* アニメーション（ふわっとスライドイン） */
  .modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.3s ease; }
  .modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
  .modal-fade-enter-active .modal-container { animation: slide-in 0.3s ease; }
  .modal-fade-leave-active .modal-container { animation: slide-in 0.3s ease reverse; }
  
  @keyframes slide-in {
    0% { transform: translateY(20px) scale(0.95); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }
  </style>