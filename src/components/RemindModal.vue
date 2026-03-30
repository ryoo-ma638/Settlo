<template>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-content slide-up">
          
          <div class="modal-header">
            <h3 class="modal-title">相手に催促を送る</h3>
            <button class="close-btn" @click="$emit('close')">×</button>
          </div>
  
          <div class="modal-body">
            <p class="desc">支払いの期限を設定して、相手に通知を送ります。</p>
  
            <div class="deadline-options">
              <label class="radio-card" :class="{ active: remindType === 'asap' }">
                <input type="radio" value="asap" v-model="remindType" class="hidden-radio">
                <div class="card-content">
                  <span class="icon">🚨</span>
                  <div class="text">
                    <h4>至急</h4>
                    <p>なるべく早く支払うよう伝えます</p>
                  </div>
                </div>
              </label>
  
              <label class="radio-card" :class="{ active: remindType === 'days' }">
                <input type="radio" value="days" v-model="remindType" class="hidden-radio">
                <div class="card-content">
                  <span class="icon">⏳</span>
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
                  <span class="icon">📅</span>
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
  
            <button class="submit-btn" @click="handleSend">催促を送信する</button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  const props = defineProps({ isOpen: Boolean });
  const emit = defineEmits(['close', 'send']);
  
  const remindType = ref('asap');
  const days = ref('');
  const date = ref('');
  
  const handleSend = () => {
    let message = '至急の';
    if (remindType.value === 'days') message = `${days.value}日以内の`;
    if (remindType.value === 'date') message = `${date.value}までの`;
    
    alert(`${message}支払い催促を相手に送信しました！`);
    emit('close');
    emit('send'); // 必要なら親コンポーネントに送信完了を伝える
  };
  </script>
  
  <style scoped>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 3000; backdrop-filter: blur(4px); }
  .modal-content { background: #f8fafc; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; padding: 30px 25px; box-sizing: border-box; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
  .modal-title { margin: 0; font-size: 20px; color: #0f172a; font-weight: 900; }
  .close-btn { background: #e2e8f0; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
  
  .desc { font-size: 13px; color: #64748b; font-weight: bold; margin-bottom: 20px; }
  
  /* 期限オプションのカードUI */
  .deadline-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 25px; }
  .hidden-radio { display: none; }
  .radio-card { display: block; background: white; border: 2px solid #e2e8f0; border-radius: 20px; padding: 16px; cursor: pointer; transition: 0.2s; }
  .radio-card.active { border-color: #ef4444; background: #fef2f2; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1); }
  .card-content { display: flex; align-items: center; gap: 15px; }
  .icon { font-size: 24px; }
  .text h4 { margin: 0 0 4px 0; font-size: 15px; font-weight: 900; color: #1e293b; }
  .text p { margin: 0; font-size: 11px; color: #64748b; font-weight: bold; }
  .radio-card.active .text h4 { color: #ef4444; }
  
  /* 入力欄（日数・日付） */
  .sub-input { display: flex; align-items: center; gap: 10px; padding: 0 10px 10px; margin-top: -5px; }
  .num-input, .date-input { padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1; outline: none; font-weight: bold; font-size: 14px; }
  .num-input { width: 80px; text-align: right; }
  .date-input { flex: 1; }
  .unit { font-size: 14px; font-weight: bold; color: #475569; }
  
  .submit-btn { width: 100%; background: #ef4444; color: white; border: none; padding: 18px; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.25); transition: 0.2s; }
  .submit-btn:active { transform: scale(0.96); }
  
  .slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .slide-down { animation: slideDown 0.2s ease-out; }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  </style>