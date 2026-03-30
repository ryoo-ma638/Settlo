<template>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
        <div class="confirm-view">
          <h2 class="modal-title">フレンド承認</h2>
          
          <div class="target-user" v-if="requestUser">
            <div class="avatar-wrapper-large">
              <img 
                v-if="requestUser && requestUser.formPhoto" 
                :src="requestUser.formPhoto" 
                class="avatar-img-large"
              />
            <div v-else class="avatar-placeholder-large" :style="{ backgroundColor: requestUser?.color || '#cbd5e1' }"></div>
          </div>
          <h3 class="name">{{ requestUser.name }}</h3>
          </div>
  
          <p class="question">このユーザーからのフレンド申請を承認しますか？</p>
  
          <div class="trade-history">
            <h4 class="history-title">過去の取引履歴</h4>
            <ul class="history-list">
              <li><span class="date">3/11</span> 飲み会代 <strong class="price">¥6,300</strong></li>
              <li><span class="date">2/20</span> タクシー代 <strong class="price">¥1,500</strong></li>
            </ul>
          </div>
  
          <div class="actions">
            <button class="btn execute-btn" @click="approve">承認する</button>
            <button class="btn cancel-btn" @click="$emit('close')">キャンセル</button>
          </div>
        </div>
      </div>
    </Teleport>
  </template>
  
  <script setup>
  const props = defineProps({
    isOpen: Boolean,
    requestUser: Object // 申請してきたユーザーの情報
  });
  
  const emit = defineEmits(['close', 'approve']);
  
  const approve = () => {
    // TODO: 将来的にFirebaseの status を "accepted" に更新する処理などを書く
    alert(`${props.requestUser.formName} さんとフレンドになりました！`);
    emit('approve', props.requestUser);
    emit('close');
  };
  </script>

  <style scoped>
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.5); z-index: 2000; display: flex; justify-content: center; align-items: center; padding: 20px; }
  .confirm-view { background: #eef7ff; width: 100%; max-width: 350px; border-radius: 30px; padding: 25px 20px; text-align: center; }
  .modal-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #1e293b; }
  .target-user { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 20px; }
  .avatar { width: 80px; height: 80px; border-radius: 50%; }
  .name { font-size: 22px; margin: 0; font-weight: bold; }
  .question { font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 20px; }
  
  .trade-history { background: #fff; padding: 15px; border-radius: 15px; text-align: left; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
  .history-title { font-size: 12px; color: #64748b; margin: 0 0 10px 0; }
  .history-list { list-style: none; padding: 0; margin: 0; font-size: 14px; }
  .history-list li { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 8px 0; }
  .history-list li:last-child { border-bottom: none; }
  .date { color: #94a3b8; font-size: 12px; }
  
  .actions { display: flex; flex-direction: column; gap: 10px; }
  .btn { width: 100%; padding: 15px; border-radius: 15px; font-size: 16px; font-weight: bold; cursor: pointer; border: none; }
  .execute-btn { background: #22c55e; color: white; } /* 承認は緑色 */
  .cancel-btn { background: #e2e8f0; color: #64748b; }

  .avatar-wrapper-large {
  width: 100px; /* スクリーンショットに合わせて調整してください */
  height: 100px;  margin: 0 auto 15px auto;  flex-shrink: 0;
}

.avatar-img-large {
  width: 100%;  height: 100%;  border-radius: 50%;  object-fit: cover;  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.avatar-placeholder-large {
  width: 100%;  height: 100%;  border-radius: 50%;
}
</style>