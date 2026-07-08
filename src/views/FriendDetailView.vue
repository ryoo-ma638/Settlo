<template>
  <div v-if="friend" class="friend-detail-container">
      <PageHeader :title="friend.name" fallback="/friend">
        <template #right>
          <button class="btn-trash" @click="handleDeleteFriend" aria-label="削除">
            <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>
          </button>
        </template>
      </PageHeader>

    <main class="scroll-content">
      <section class="total-balance-card" 
        @click="$router.push({ 
          path: '/combined-settlement/' + $route.params.name, 
          query: { uid: route.params.uid } 
        })"
      >
    <div class="balance-label">トータルの貸し借り</div>
    <div class="balance-main">
      <h2 class="balance-amount" :class="netBalance >= 0 ? 'blue-text' : 'orange-text'">
        {{ netBalance >= 0 ? '受け取る' : '支払う' }} ¥{{ Math.abs(netBalance).toLocaleString() }}
      </h2>
      <span class="arrow-icon">›</span>
    </div>
    <div class="balance-sub-info">
      <div class="sub-item"><span class="dot blue-dot"></span> お支払い待ち: ¥{{ waitingTotal.toLocaleString() }}</div>
      <div class="sub-item"><span class="dot orange-dot"></span> 未払い: ¥{{ unpaidTotal.toLocaleString() }}</div>
    </div>
  </section> 
  <h2 class="section-title">{{ friend.name }} さんとのお支払い状況</h2>

      <section class="tx-section" v-if="receivableItems.length">
        <div class="tx-section__head">
          <span class="chip chip--recv">お支払い待ち（受け取る）</span>
          <span class="tx-section__total blue-text tnum">¥{{ waitingTotal.toLocaleString() }}</span>
        </div>
        <div class="tx-list">
          <div v-for="t in receivableItems" :key="t.id" class="tx" @click="$router.push('/payment-detail/waiting-' + t.id)">
            <div class="tx__info">
              <span class="tx__name">{{ t.itemName }}</span>
              <span class="tx__status" :class="'st-' + t.status">{{ t.statusLabel }}</span>
            </div>
            <div class="tx__right">
              <span class="tx__amount tnum">¥{{ t.amount.toLocaleString() }}</span>
              <svg class="tx__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </section>
      
      <section class="tx-section" v-if="payableItems.length">
        <div class="tx-section__head">
          <span class="chip chip--pay">未払い（支払う）</span>
          <span class="tx-section__total orange-text tnum">¥{{ unpaidTotal.toLocaleString() }}</span>
        </div>
        <div class="tx-list">
          <div v-for="t in payableItems" :key="t.id" class="tx" @click="$router.push('/payment-detail/unpaid-' + t.id)">
            <div class="tx__info">
              <span class="tx__name">{{ t.itemName }}</span>
              <span class="tx__status" :class="'st-' + t.status">{{ t.statusLabel }}</span>
            </div>
            <div class="tx__right">
              <span class="tx__amount tnum">¥{{ t.amount.toLocaleString() }}</span>
              <svg class="tx__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </section>

      <div v-if="!receivableItems.length && !payableItems.length" class="empty-box">未決済の取引はありません</div>

      <section class="hist-section">
        <h3 class="hist-section__title">{{ friend.name }} さんとの履歴</h3>
        <div v-if="historyItems.length === 0" class="empty-box">履歴はありません</div>
        <div v-for="h in historyItems" :key="h.id" class="histrow">
          <div class="histrow__info">
            <span class="histrow__name">{{ h.itemName }}</span>
            <span class="histrow__status" :class="'st-' + h.status">{{ h.statusLabel }}</span>
          </div>
          <span class="histrow__amount tnum" :class="h.type === 'pay' ? 'orange-text' : 'blue-text'">
            {{ h.type === 'pay' ? '−' : '+' }}¥{{ h.amount.toLocaleString() }}
          </span>
        </div>
      </section>
    </main>
    
    <BaseModal 
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      :showCancel="modalState.showCancel"
      :confirmText="modalState.confirmText"
      :cancelText="modalState.cancelText"
      @confirm="handleConfirmModal"
      @cancel="modalState.show = false"
      @close="modalState.show = false"
    />
  </div>

  <div v-else class="loading-state">
    <p>読み込み中、またはデータが見つかりません...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'; // 🌟 reactive追加
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { doc, deleteDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 統一モーダル追加
import PageHeader from '@/components/PageHeader.vue';

const waitingTotal = ref(0); // この相手から受け取る未決済合計
const unpaidTotal = ref(0);  // この相手へ支払う未決済合計
const receivableItems = ref([]); // 受け取り（相手→自分・未完了）
const payableItems = ref([]);    // 支払い（自分→相手・未完了）
const historyItems = ref([]);    // 全履歴（完了含む）
const route = useRoute();
const router = useRouter();

const myPhoto = ref("");
const friendPhoto = ref("");
const friend = ref(null);

const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);

// 🌟 モーダル状態管理
const modalState = reactive({
  show: false, type: 'info', title: '', message: '', 
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
};
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

onMounted(async () => {
  const uid = route.query.uid || route.params.uid;
  const myUid = auth.currentUser?.uid;
  
  if (!uid || !myUid) return;

  try {
    const myDoc = await getDoc(doc(db, "users", myUid));
    if (myDoc.exists()) myPhoto.value = myDoc.data().photo || myDoc.data().photoURL || "";

    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      friend.value = data;
      friendPhoto.value = data.photo || data.photoURL || "";
    }

    // 🌟 この相手との取引を実データから取得し、各リスト・履歴・残高を構築（複合index回避）
    const statusLabel = (s) => s === 'completed' ? '完了' : (s === 'awaiting_approval' ? '承認待ち' : '未決済');
    const recvList = [], payList = [], histList = [];
    let recvSum = 0, paySum = 0;

    const recvSnap = await getDocs(query(collection(db, "transactions"), where("paidToId", "==", myUid)));
    recvSnap.forEach((d) => {
      const t = d.data();
      if (t.paidById !== uid) return;
      const s = t.status || 'unpaid';
      const item = { id: d.id, amount: t.amount || 0, itemName: t.itemName || 'イベント代', status: s, statusLabel: statusLabel(s), type: 'receive', createdAt: t.createdAt };
      histList.push(item);
      if (s !== 'completed') { recvList.push(item); recvSum += item.amount; }
    });

    const paySnap = await getDocs(query(collection(db, "transactions"), where("paidById", "==", myUid)));
    paySnap.forEach((d) => {
      const t = d.data();
      if (t.paidToId !== uid) return;
      const s = t.status || 'unpaid';
      const item = { id: d.id, amount: t.amount || 0, itemName: t.itemName || 'イベント代', status: s, statusLabel: statusLabel(s), type: 'pay', createdAt: t.createdAt };
      histList.push(item);
      if (s !== 'completed') { payList.push(item); paySum += item.amount; }
    });

    histList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    receivableItems.value = recvList;
    payableItems.value = payList;
    historyItems.value = histList;
    waitingTotal.value = recvSum;
    unpaidTotal.value = paySum;
  } catch (error) {
    console.error("データ取得中にエラーが発生しました:", error);
  }
});

// 🌟 フレンド削除 (ダサい confirm と alert を美しいモーダルに！)
const handleDeleteFriend = async () => {
  const friendName = route.params.name;
  const friendUid = route.params.uid; 
  const myUid = auth.currentUser?.uid;

  if (!myUid || !friendUid) {
    showModal({ type: 'error', title: 'エラー', message: 'ユーザー情報の取得に失敗しました。' });
    return;
  }

  showModal({
    type: 'warning',
    title: 'フレンド削除の確認',
    message: `${friendName} さんをフレンドから削除しますか？\n(相手のリストからもあなたが削除されます)`,
    showCancel: true,
    confirmText: '削除する',
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, "users", myUid, "friends", friendUid));
        await deleteDoc(doc(db, "users", friendUid, "friends", myUid));

        // 削除成功したら完了モーダルを出して、OKを押したら一覧に戻る
        showModal({
          type: 'success', title: '削除完了', message: `${friendName} さんを削除しました。`,
          onConfirm: () => router.push('/friend')
        });
      } catch (error) {
        console.error("削除エラー:", error);
        showModal({ type: 'error', title: 'エラー', message: '削除に失敗しました。' });
      }
    }
  });
};
</script>

<style scoped>
/* 🌟 コンテナ全体の余白を調整（共通ヘッダーの下に配置） */
.friend-detail-container { 
  height: 100vh; 
  box-sizing: border-box;
  background-color: #f8fafc; 
  display: flex;
  flex-direction: column;
}

/* 🌟 ヘッダーをグラデーションでおしゃれに */
.detail-header { 
  flex-shrink: 0; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 20px 20px 25px; 
  background: linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%);
  border-radius: 0 0 30px 30px; 
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  margin-bottom: 15px;
}

.back-btn { background: none; border: none; font-size: 32px; color: #1e293b; cursor: pointer; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.user-info-block { display: flex; align-items: center; gap: 15px; }
.user-name { font-size: 22px; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: 0.5px; }
.delete-link-btn { background: rgba(255, 255, 255, 0.5); border: none; color: #ef4444; font-size: 12px; font-weight: 900; padding: 6px 12px; border-radius: 12px; cursor: pointer; transition: 0.2s; }
.delete-link-btn:active { background: #fee2e2; }

/* 🌟 アイコンの枠をリッチに */
.main-avatar-wrapper { padding: 3px; background: white; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.main-avatar-img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block; }
.default-avatar { width: 56px; height: 56px; border-radius: 50%; display: block; }

.scroll-content { flex: 1; overflow-y: auto; padding: 15px 20px; scrollbar-width: none; }
.scroll-content::-webkit-scrollbar { display: none; }

/* 🌟 トータル収支カードを洗練 */
.total-balance-card { background-color: #fff; border-radius: 28px; padding: 24px; margin-bottom: 25px; box-shadow: 0 8px 30px rgba(33, 105, 163, 0.08); cursor: pointer; text-align: center; border: 1px solid #f1f5f9; }
.balance-label { font-size: 13px; font-weight: 800; color: #64748b; margin-bottom: 12px; }
.balance-main { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
.balance-amount { font-size: 36px; font-weight: 900; margin: 0; letter-spacing: -1px; }
.arrow-icon { font-size: 24px; color: #cbd5e1; }
.balance-sub-info { font-size: 11px; color: #94a3b8; display: flex; justify-content: center; gap: 15px; background: #f8fafc; padding: 8px; border-radius: 12px; }
.sub-item { display: flex; align-items: center; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.blue-dot { background-color: #3b82f6; }
.orange-dot { background-color: #f59e0b; }

.section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: left; }
.status-section { background-color: #fff; border-radius: 20px; padding: 15px; margin-bottom: 20px; }
.status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; position: relative; }
.status-badge { padding: 4px 12px; border-radius: 15px; color: white; font-size: 11px; font-weight: bold; }
.blue-badge { background-color: #3b82f6; }
.orange-badge { background-color: #f59e0b; }
.total-amount { font-size: 28px; font-weight: bold; }
.blue-text { color: var(--c-receive); }
.orange-text { color: var(--c-pay); }
.pay-all-btn { position: absolute; right: 0; }

.event-list { display: flex; flex-direction: column; gap: 10px; }
.event-card { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-radius: 12px; }
.blue-card { background-color: #e0f2fe; }
.orange-card { background-color: #ffedd5; }
.event-info { display: flex; flex-direction: column; text-align: left; }
.event-date { font-size: 11px; color: #666; }
.event-name { font-size: 15px; font-weight: bold; }
.event-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.event-amount { font-size: 16px; font-weight: bold; }
.action-btn { padding: 5px 12px; border-radius: 20px; border: none; font-size: 11px; font-weight: bold; color: #fff; cursor: pointer; }
.green-btn { background-color: var(--c-brand); }
.red-btn { background-color: #ef4444; color: #ffffff; }

.history-toggle-btn { width: 100%; padding: 12px; background-color: #93c5fd; color: #fff; border: none; border-radius: 15px; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
.history-card { background-color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 40px; margin-bottom: 10px; }
.history-event-name { font-size: 16px; font-weight: bold; }
.history-flow { display: flex; align-items: center; gap: 8px; }
.avatar { width: 25px; height: 25px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #dcdcdc; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { width: 100%; height: 100%; }
.history-amount { font-size: 18px; font-weight: bold; }
.check-icon { color: var(--c-brand); display: flex; align-items: center; }
.check-icon svg { width: 20px; height: 20px; }

/* --- 取引リスト（実データ） --- */
.tx-section { margin: 0 16px 16px; }
.tx-section__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.tx-section__total { font-size: 17px; font-weight: var(--fw-black); }
.chip { display: inline-block; font-size: 11px; font-weight: var(--fw-bold); padding: 4px 11px; border-radius: var(--r-pill); }
.chip--recv { background: var(--c-receive-weak); color: var(--c-receive); }
.chip--pay { background: var(--c-pay-weak); color: var(--c-pay-strong); }
.tx-list { display: flex; flex-direction: column; gap: 8px; }
.tx { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--c-surface); border-radius: var(--r-md); padding: 13px 14px; box-shadow: var(--shadow-card); cursor: pointer; transition: transform 0.15s ease; }
.tx:active { transform: scale(0.985); }
.tx__info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tx__name { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx__status { font-size: 11px; font-weight: var(--fw-bold); }
.tx__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tx__amount { font-size: 16px; font-weight: var(--fw-black); color: var(--c-ink); }
.tx__chevron { width: 18px; height: 18px; fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.st-unpaid { color: var(--c-text-faint); }
.st-awaiting_approval { color: var(--c-pay-strong); }
.st-completed { color: var(--c-receive); }

/* --- 履歴（実データ） --- */
.hist-section { margin: 22px 16px 0; }
.hist-section__title { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); margin-bottom: 12px; }
.histrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--c-surface); border-radius: var(--r-md); padding: 13px 14px; box-shadow: var(--shadow-card); margin-bottom: 8px; }
.histrow__info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.histrow__name { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.histrow__status { font-size: 11px; font-weight: var(--fw-bold); }
.histrow__amount { font-size: 16px; font-weight: var(--fw-black); flex-shrink: 0; }
</style>