<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
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

        <p class="question">{{ requestUser?.name || requestUser?.formName }}さんからのフレンド申請を承認しますか？</p>
        <p v-if="approvalState === 'unknown'" class="approval-warning" role="alert">申請の状態を確認できませんでした。通信状況を確認して、もう一度開き直してください。</p>

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
          <button class="btn execute-btn" :disabled="saving || approvalState !== 'ready'" @click="approve">{{ saving ? '承認しています…' : approvalState === 'loading' ? '状態を確認しています…' : '承認する' }}</button>
          <button class="btn cancel-btn" :disabled="saving" @click="close">閉じる</button>
          <button class="reject-link" :disabled="saving" @click="confirmReject">この申請を拒否する</button>
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
  requestUser: Object,
  saving: Boolean,
  approvalState: { type: String, default: 'loading' },
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

const close = () => {
  if (!props.saving) emit('close');
};

// 拒否は、閉じる操作とは分けて明示的に確認する。
const confirmReject = () => {
  showModal({
    type: 'warning',
    title: '申請を拒否しますか？',
    message: 'このフレンド申請を一覧から削除します。',
    showCancel: true,
    confirmText: '拒否する',
    cancelText: '戻る',
    onConfirm: () => { emit('reject', props.requestUser); emit('close'); },
  });
};

const approve = () => {
  if (!props.saving && props.approvalState === 'ready') emit('approve', props.requestUser);
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
.approval-warning { margin: -8px 0 18px; padding: 10px; border-radius: 10px; background: var(--c-pay-weak); color: var(--c-text); font-size: 12px; line-height: 1.6; text-align: left; }

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
.btn:disabled, .reject-link:disabled { cursor: wait; opacity: .65; }
.reject-link { border: 0; padding: 4px; background: transparent; color: var(--c-text-sub); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }

.avatar-wrapper-large { display: flex; margin: 0 auto 15px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
</style>
