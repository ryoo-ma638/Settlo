<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="confirm-view">
        <h2 class="modal-title">フレンド承認</h2>
        
        <div class="target-user" v-if="requestUser">
          <UserAvatar
            class="avatar-wrapper-large"
            :name="requestUser.name || requestUser.formName"
            :photo="requestUser.formPhoto"
            :size="100"
          />
        <h3 class="name">{{ requestUser.name || requestUser.formName }}</h3>
        </div>

        <p class="question">このユーザーからのフレンド申請を承認しますか？</p>

        <div class="trade-history" v-if="tradeHistory.length > 0">
          <h4 class="history-title">この人との取引履歴</h4>
          <ul class="history-list">
            <li v-for="t in tradeHistory" :key="t.id">
              <span class="date">{{ t.date }}</span> {{ t.itemName }} <strong class="price">¥{{ t.amount.toLocaleString() }}</strong>
            </li>
          </ul>
        </div>
        <p v-else-if="historyLoaded" class="no-history">この人との取引履歴はまだありません</p>

        <div class="actions">
          <button class="btn execute-btn" @click="approve">承認する</button>
          <button class="btn cancel-btn" @click="onCancelClick">キャンセル</button>
        </div>
      </div>
    </div>
    
    <BaseModal
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :showCancel="modalState.showCancel"
      :confirmText="modalState.confirmText"
      :cancelText="modalState.cancelText"
      @confirm="handleConfirmModal"
      @cancel="handleCancelModal"
      @close="modalState.show = false"
    />
  </Teleport>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { db, auth } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const props = defineProps({
  isOpen: Boolean,
  requestUser: Object
});
const emit = defineEmits(['close', 'approve', 'reject']);

// 🌟 この相手との「本物の取引履歴」を Firestore から取得して表示
const tradeHistory = ref([]);
const historyLoaded = ref(false);
const loadHistory = async () => {
  tradeHistory.value = [];
  historyLoaded.value = false;
  const myUid = auth.currentUser?.uid;
  // 申請者のUIDは formId（送信者）。フレンド一覧から開いた場合は uid。
  const theirUid = props.requestUser?.formId || props.requestUser?.uid || props.requestUser?.id;
  if (myUid && theirUid) {
    try {
      const [s1, s2] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('paidById', '==', myUid))),
        getDocs(query(collection(db, 'transactions'), where('paidToId', '==', myUid))),
      ]);
      const results = [];
      const pushIf = (d) => {
        const x = d.data();
        if (x.paidById === theirUid || x.paidToId === theirUid) {
          results.push({
            id: d.id,
            itemName: x.itemName || '取引',
            amount: x.amount || 0,
            sec: x.createdAt?.seconds || 0,
            date: x.createdAt ? new Date(x.createdAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '',
          });
        }
      };
      s1.forEach(pushIf);
      s2.forEach(pushIf);
      const seen = new Set();
      tradeHistory.value = results
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .sort((a, b) => b.sec - a.sec);
    } catch (e) {
      console.error('取引履歴の取得エラー:', e);
    }
  }
  historyLoaded.value = true;
};
// isOpen と requestUser の両方を監視（開いた瞬間に相手が確定しているとは限らないため）
watch([() => props.isOpen, () => props.requestUser], ([open, ru]) => {
  if (open && ru) loadHistory();
});

// 🌟 モーダル状態管理
const modalState = reactive({ show: false, type: 'info', title: '', message: '', showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, onCancel: null });
const showModal = (options) => { Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, onCancel: null, ...options, show: true }); };
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};
const handleCancelModal = () => {
  modalState.show = false;
  if (modalState.onCancel) modalState.onCancel();
};

// 🌟 キャンセル時：心当たりがあるか確認（誤操作・知らない人の防止）
const onCancelClick = () => {
  showModal({
    type: 'warning',
    title: '確認',
    message: 'このフレンドは心当たりのない人ですか？\n「はい」で申請を拒否します。',
    showCancel: true,
    confirmText: 'はい',
    cancelText: 'いいえ',
    onConfirm: () => { emit('reject', props.requestUser); emit('close'); }, // 知らない人 → 申請を拒否
    // いいえ → 確認だけ閉じて承認画面に戻る（onCancel なし）
  });
};

const approve = () => {
  // 🌟 alert を美しいモーダルに
  showModal({
    type: 'success',
    title: '承認完了',
    message: `${props.requestUser.name || props.requestUser.formName} さんとフレンドになりました！`,
    onConfirm: () => {
      emit('approve', props.requestUser);
      emit('close');
    }
  });
};
</script>

<style scoped>
/* 既存スタイルそのまま */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: var(--c-overlay); z-index: 2000; display: flex; justify-content: center; align-items: center; padding: 20px; }
.confirm-view { background: #eef7ff; width: 100%; max-width: 350px; border-radius: 30px; padding: 25px 20px; text-align: center; }
.modal-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: var(--c-text); }
.target-user { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 20px; }
.avatar { width: 80px; height: 80px; border-radius: 50%; }
.name { font-size: 22px; margin: 0; font-weight: bold; }
.question { font-size: 14px; font-weight: bold; color: var(--c-text); margin-bottom: 20px; }

.trade-history { background: #fff; padding: 15px; border-radius: 15px; text-align: left; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
.history-title { font-size: 12px; color: var(--c-text-sub); margin: 0 0 10px 0; }
.history-list { list-style: none; padding: 0; margin: 0; font-size: 14px; }
.history-list li { display: flex; justify-content: space-between; border-bottom: 1px dashed var(--c-line-strong); padding: 8px 0; }
.history-list li:last-child { border-bottom: none; }
.date { color: var(--c-text-faint); font-size: 12px; }
.no-history { font-size: 12px; color: var(--c-text-faint); font-weight: 700; text-align: center; margin: 0 0 22px; }

.actions { display: flex; flex-direction: column; gap: 10px; }
.btn { width: 100%; padding: 15px; border-radius: 15px; font-size: 16px; font-weight: bold; cursor: pointer; border: none; }
.execute-btn { background: var(--c-brand); color: white; } 
.cancel-btn { background: var(--c-line-bold); color: var(--c-text-sub); }

.avatar-wrapper-large { display: flex; margin: 0 auto 15px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
</style>