<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h3 class="modal-title">相手に催促を送る</h3>
          <button class="close-btn" @click="$emit('close')" aria-label="閉じる">×</button>
        </div>

        <div class="modal-body">
          <p class="desc">支払いの期限を設定して、相手に通知を送ります。</p>

          <div class="deadline-options">
            <label class="radio-card" :class="{ active: remindType === 'asap' }">
              <input type="radio" value="asap" v-model="remindType" class="hidden-radio">
              <div class="card-content">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg></span>
                <div class="text">
                  <h4>至急</h4>
                  <p>なるべく早く支払うよう伝えます</p>
                </div>
              </div>
            </label>

            <label class="radio-card" :class="{ active: remindType === 'days' }">
              <input type="radio" value="days" v-model="remindType" class="hidden-radio">
              <div class="card-content">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg></span>
                <div class="text">
                  <h4>日数で指定</h4>
                  <p>指定した日数以内のお支払いを求めます</p>
                </div>
              </div>
            </label>
            <div v-if="remindType === 'days'" class="sub-input slide-down">
              <input type="number" v-model="days" placeholder="例: 3" class="num-input"> <span class="unit">日以内</span>
            </div>

            <label class="radio-card" :class="{ active: remindType === 'date' }">
              <input type="radio" value="date" v-model="remindType" class="hidden-radio">
              <div class="card-content">
                <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg></span>
                <div class="text">
                  <h4>日付で指定</h4>
                  <p>指定した期日までのお支払いを求めます</p>
                </div>
              </div>
            </label>
            <div v-if="remindType === 'date'" class="sub-input slide-down">
              <input type="date" v-model="date" class="date-input"> <span class="unit">まで</span>
            </div>
          </div>

          <div class="msg-field">
            <label class="msg-label">ひとこと（任意）</label>
            <textarea
              v-model="message"
              class="msg-input"
              rows="2"
              maxlength="200"
              placeholder="相手に伝えたいことがあれば添えられます（例：来週までに返してもらえると助かります）"
            ></textarea>
            <span class="msg-count">{{ message.length }}/200</span>
          </div>

          <button class="submit-btn" @click="handleSend">催促を送信する</button>
        </div>
      </div>
    </div>
    
    <BaseModal 
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      @confirm="handleConfirmModal"
      @close="modalState.show = false"
    />
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 追加

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close', 'send']);

const remindType = ref('asap');
const days = ref('');
const date = ref('');
const message = ref('');

// 🌟 モーダル状態管理
const modalState = reactive({ show: false, type: 'info', title: '', message: '', onConfirm: null });
const showModal = (options) => { Object.assign(modalState, { onConfirm: null, ...options, show: true }); };
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

const handleSend = () => {
  let deadline = '至急';
  if (remindType.value === 'days') deadline = `${days.value || '数'}日以内`;
  if (remindType.value === 'date') deadline = `${date.value || ''}まで`;
  // 実際の通知送信は親（呼び出し元）が行う
  emit('send', { deadline, message: message.value.trim() });
};
</script>

<style scoped>
/* 既存スタイルそのまま */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--c-overlay); display: flex; align-items: flex-end; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
.modal-content { background: var(--c-surface-2); width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; padding: 30px 25px; box-sizing: border-box; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.modal-title { margin: 0; font-size: 20px; color: var(--c-ink); font-weight: 900; }
.close-btn { background: var(--c-line-bold); border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; color: var(--c-text-sub); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.desc { font-size: 13px; color: var(--c-text-sub); font-weight: bold; margin-bottom: 20px; }
.deadline-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px; }
.hidden-radio { display: none; }
.radio-card { display: block; background: white; border: 2px solid var(--c-line-bold); border-radius: 20px; padding: 16px; cursor: pointer; transition: 0.2s; }
.radio-card.active { border-color: var(--c-danger); background: var(--c-danger-weak); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1); }
.card-content { display: flex; align-items: center; gap: 15px; }
.icon { color: var(--c-text-sub); display: flex; flex-shrink: 0; }
.icon svg { width: 24px; height: 24px; }
.radio-card.active .icon { color: var(--c-danger); }
.text h4 { margin: 0 0 4px 0; font-size: 15px; font-weight: 900; color: var(--c-text); }
.text p { margin: 0; font-size: 11px; color: var(--c-text-sub); font-weight: bold; }
.radio-card.active .text h4 { color: var(--c-danger); }
.sub-input { display: flex; align-items: center; gap: 10px; padding: 0 10px 10px; margin-top: -5px; }
.num-input, .date-input { padding: 10px; border-radius: 12px; border: 1px solid var(--c-line-strong); outline: none; font-weight: bold; font-size: 14px; }
.num-input { width: 80px; text-align: right; }
.date-input { flex: 1; }
.unit { font-size: 14px; font-weight: bold; color: var(--c-text-strong); }
.msg-field { position: relative; margin-bottom: 25px; }
.msg-label { display: block; font-size: 12px; font-weight: 900; color: var(--c-text-strong); margin-bottom: 8px; }
.msg-input { width: 100%; box-sizing: border-box; background: white; border: 1px solid var(--c-line-strong); border-radius: 14px; padding: 12px 14px; font-size: 14px; font-weight: 600; color: var(--c-ink); font-family: inherit; resize: vertical; outline: none; transition: border-color 0.15s; }
.msg-input::placeholder { color: var(--c-text-faint); font-weight: 500; }
.msg-input:focus { border-color: var(--c-danger); }
.msg-count { position: absolute; right: 4px; bottom: -18px; font-size: 11px; color: var(--c-text-faint); font-weight: 700; }
.submit-btn { width: 100%; background: var(--c-danger); color: white; border: none; padding: 18px; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.25); transition: 0.2s; }
.submit-btn:active { transform: scale(0.96); }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.slide-down { animation: slideDown 0.2s ease-out; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>