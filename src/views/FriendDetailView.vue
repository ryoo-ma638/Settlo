<template>
  <div class="friend-detail-container">
    <PageHeader :title="friend?.name || 'フレンド'" fallback="/friend">
      <template #right>
        <button v-if="friend" class="btn-trash" @click="handleDeleteFriend" aria-label="フレンドから削除">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>
        </button>
      </template>
    </PageHeader>
    <div v-if="loading" class="load-state" role="status">取引を読み込んでいます</div>
    <div v-else-if="loadError" class="load-state" role="alert">
      <p>{{ loadError }}</p><button class="retry-button" @click="loadFriend">もう一度読み込む</button>
    </div>
    <main v-else-if="friend" class="scroll-content">
      <section class="balance-panel" aria-label="この相手との貸し借り">
        <div class="balance-heading"><h2>この人との貸し借り</h2><span>{{ openHistoryCount ? `未精算 ${openHistoryCount}件` : '未精算なし' }}</span></div>
        <div class="balance-main" :class="netBalance > 0 ? 'blue-text' : netBalance < 0 ? 'orange-text' : ''">
          <span class="balance-direction">{{ netBalance > 0 ? '受け取る' : netBalance < 0 ? '支払う' : '差額なし' }}</span>
          <strong class="balance-amount tnum">¥{{ Math.abs(netBalance).toLocaleString() }}</strong>
        </div>
        <dl class="balance-breakdown">
          <div class="receive-breakdown"><dt>受け取る分</dt><dd class="blue-text tnum">¥{{ waitingTotal.toLocaleString() }}</dd></div>
          <div class="pay-breakdown"><dt>支払う分</dt><dd class="orange-text tnum">¥{{ unpaidTotal.toLocaleString() }}</dd></div>
        </dl>
        <button v-if="hasOpenItems" class="balance-cta" @click="openCombined">
          {{ historyItems.some(t => t.status === 'unpaid') ? '支払う分・受け取る分を選ぶ' : '確認待ちの明細を見る' }}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <p v-if="netBalance === 0" class="balance-note">{{ hasOpenItems ? '支払う分と受け取る分は同じ金額ですが、未精算の明細が残っています。' : '未精算の取引はありません' }}</p>
        <!-- イベントを作らずに、この人との立て替えを1件だけ記録する -->
        <button class="balance-sub balance-sub--add" @click="splitOpen = true">
          この人と割り勘を記録する
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <!-- 相手ごとの会話一覧。これまでどこからも開けなかった -->
        <button class="balance-sub" @click="openChats">
          この人との会話を見る
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </section>

      <section class="history-section" aria-label="取引履歴">
        <header class="section-title">
          <h2>取引履歴</h2>
          <div class="history-title-actions">
            <span>{{ filteredHistoryCount }}件</span>
            <button class="history-sort-button" :aria-label="historySort === 'newest' ? '古い順に並べ替える' : '新しい順に並べ替える'" @click="historySort = historySort === 'newest' ? 'oldest' : 'newest'">
              <svg viewBox="0 0 16 16" aria-hidden="true" :class="{ oldest: historySort === 'oldest' }"><path d="M8 2v12M4.5 10.5 8 14l3.5-3.5"/></svg>
              {{ historySort === 'newest' ? '新しい順' : '古い順' }}
            </button>
          </div>
        </header>
        <div v-if="historyItems.length" class="history-filter" role="group" aria-label="取引履歴の表示切替">
          <button
            v-for="option in historyFilterOptions"
            :key="option.value"
            class="history-filter-button"
            :class="{ active: historyFilter === option.value }"
            :aria-pressed="historyFilter === option.value"
            @click="historyFilter = option.value"
          >
            <span>{{ option.label }}</span><strong class="tnum">{{ option.count }}</strong>
          </button>
        </div>
        <div v-if="historySubfilterOptions.length" class="history-subfilter" role="group" :aria-label="historyFilter === 'open' ? '未精算の状態で絞り込む' : '精算済みの方向で絞り込む'">
          <button
            v-for="option in historySubfilterOptions"
            :key="option.value"
            class="history-subfilter-button"
            :class="{ active: historySubfilter === option.value }"
            :aria-pressed="historySubfilter === option.value"
            @click="historySubfilter = option.value"
          >
            <span>{{ option.label }}</span><strong class="tnum">{{ option.count }}</strong>
          </button>
        </div>
        <p v-if="!historyItems.length" class="empty-note">取引履歴はまだありません</p>
        <p v-else-if="!filteredHistoryCount" class="empty-note">該当する取引はありません</p>
        <section v-for="group in filteredHistoryGroups" :key="group.month" class="history-month">
          <h2>{{ group.month }}</h2>
          <div class="ledger-list">
            <button v-for="h in group.items" :key="h.id" class="ledger-row" @click="openTx(h, h.type === 'pay' ? 'unpaid' : 'waiting')">
              <span class="ledger-info"><span class="ledger-name">{{ h.itemName }}</span><span class="ledger-date">{{ registrationLabel(h.createdAt) }}</span><span v-if="h.eventName" class="ledger-event">{{ h.eventName }}</span><span class="ledger-status" :class="statusTone(h)">{{ transactionStatus(h) }}</span></span>
              <span class="ledger-right"><span class="history-money" :class="h.type === 'pay' ? 'orange-text' : 'blue-text'"><span>{{ h.type === 'pay' ? '支払う分' : '受け取る分' }}</span><strong class="tnum">¥{{ h.amount.toLocaleString() }}</strong></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>
            </button>
          </div>
        </section>
      </section>
    </main>
    <BaseModal :show="modalState.show" :type="modalState.type" :title="modalState.title" :message="modalState.message" :showCancel="modalState.showCancel" :confirmText="modalState.confirmText" :cancelText="modalState.cancelText" @confirm="handleConfirmModal" @cancel="modalState.show = false" @close="modalState.show = false" />
  </div>

    <FriendPaymentModal
      :isOpen="splitOpen"
      :friendName="friend?.name || '相手'"
      :friendUid="route.query.uid || route.params.uid || ''"
      @close="splitOpen = false"
      @saved="loadFriend"
    />
</template>

<script setup>
import { ref, computed, watch, onUnmounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { doc, deleteDoc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 統一モーダル追加
import { getMyName } from '@/lib/userName';
import FriendPaymentModal from '@/components/FriendPaymentModal.vue';
import PageHeader from '@/components/PageHeader.vue';
import { collapsePendingBatches } from '@/lib/balance';
import { registrationLabel, historyMonth, dateMillis, transactionStatus, transactionCategory, statusTone } from '../lib/friendHistory.js';
import { eventSettlementRouteOf, eventSettlementStatusLabel, isEventSettlementReserved } from '@/lib/eventSettlementGuard';

const waitingTotal = ref(0); // この相手から受け取る未決済合計
const unpaidTotal = ref(0);  // この相手へ支払う未決済合計
const receivableItems = ref([]); // 受け取り（相手→自分・未完了）
const payableItems = ref([]);    // 支払い（自分→相手・未完了）
const historyItems = ref([]);    // 全履歴（完了含む）
const historyFilter = ref('all');
const historySubfilter = ref('all');
const historySort = ref('newest');
const route = useRoute();
const router = useRouter();

const friend = ref(null);
const loading = ref(true);
const loadError = ref('');
const hasOpenItems = computed(() => receivableItems.value.length + payableItems.value.length > 0);
const openHistoryCount = computed(() => historyItems.value.filter(t => t.status !== 'completed').length);
const completedHistoryCount = computed(() => historyItems.value.filter(t => t.status === 'completed').length);
const historyFilterOptions = computed(() => [
  { value: 'all', label: 'すべて', count: historyItems.value.length },
  { value: 'open', label: '未精算', count: openHistoryCount.value },
  { value: 'completed', label: '精算済み', count: completedHistoryCount.value },
]);
const countCategory = value => historyItems.value.filter(item => transactionCategory(item) === value).length;
const historySubfilterOptions = computed(() => {
  if (historyFilter.value === 'open') return [
    { value: 'all', label: 'すべて', count: openHistoryCount.value },
    { value: 'unpaid', label: '未払い', count: countCategory('unpaid') },
    { value: 'waiting-payment', label: 'お支払い待ち', count: countCategory('waiting-payment') },
    { value: 'confirm-self', label: '受け取りを確認', count: countCategory('confirm-self') },
    { value: 'confirm-other', label: '相手の確認待ち', count: countCategory('confirm-other') },
    // まとめて精算に予約された分は他の状態に数えないので、その分を見る入口を出す。
    // ほとんどの人は0件なので、あるときだけ出す（常時0のボタンを全員に見せない）。
    ...(countCategory('event-settlement') ? [{ value: 'event-settlement', label: 'まとめて精算中', count: countCategory('event-settlement') }] : []),
  ];
  if (historyFilter.value === 'completed') return [
    { value: 'all', label: 'すべて', count: completedHistoryCount.value },
    { value: 'paid', label: '支払った', count: countCategory('paid') },
    { value: 'received', label: '受け取った', count: countCategory('received') },
  ];
  return [];
});
watch(historyFilter, () => { historySubfilter.value = 'all'; });
const filteredHistoryItems = computed(() => {
  const primary = historyFilter.value === 'open'
    ? historyItems.value.filter(t => t.status !== 'completed')
    : historyFilter.value === 'completed'
      ? historyItems.value.filter(t => t.status === 'completed')
      : historyItems.value;
  if (historySubfilter.value === 'all' || historyFilter.value === 'all') return primary;
  return primary.filter(item => transactionCategory(item) === historySubfilter.value);
});
const filteredHistoryCount = computed(() => filteredHistoryItems.value.length);
const sortedHistoryItems = computed(() => [...filteredHistoryItems.value].sort((a, b) => {
  const difference = dateMillis(a.createdAt) - dateMillis(b.createdAt);
  return historySort.value === 'oldest' ? difference : -difference;
}));
const filteredHistoryGroups = computed(() => {
  const groups = new Map();
  for (const item of sortedHistoryItems.value) {
    const month = historyMonth(item.createdAt);
    if (!groups.has(month)) groups.set(month, { month, items: [] });
    groups.get(month).items.push(item);
  }
  return [...groups.values()];
});
// 相手ごとの会話一覧へ。取引に紐づく会話が複数あるときにまとめて見られる。
const splitOpen = ref(false);

const openChats = () => router.push('/chats/' + encodeURIComponent(route.query.uid || route.params.uid || ''));

const openCombined = () => router.push({ path: '/combined-settlement/' + encodeURIComponent(friend.value.name), query: { uid: route.query.uid || route.params.uid } });

const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);

// まとめ精算に含まれる元明細は、main/offsetのどちらから開いても同じまとめ詳細へ進む。
// 元明細の向きではなく、batchに記録した実際の支払人・受取人から画面の向きを決める。
const openTx = (t, prefix) => {
  if (isEventSettlementReserved(t)) {
    const target = eventSettlementRouteOf(t);
    if (target) router.push(target);
    return;
  }
  const batch = t.settlementBatch;
  const batchId = batch?.id || (t.isBatchRow ? t.batchId : null);
  if (batchId) {
    const myUid = auth.currentUser?.uid;
    const batchPrefix = batch?.payerUid === myUid ? 'unpaid'
      : batch?.receiverUid === myUid ? 'waiting' : prefix;
    router.push(`/payment-detail/${batchPrefix}-batch-${batchId}`);
    return;
  }
  router.push(`/payment-detail/${prefix}-${t.id}`);
};

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

let loadVersion = 0;
const loadFriend = async () => {
  const version = ++loadVersion;
  loading.value = true;
  loadError.value = '';
  friend.value = null;
  const uid = route.query.uid || route.params.uid;
  const myUid = auth.currentUser?.uid;
  if (!uid || !myUid) {
    loadError.value = '相手の情報を確認できません。一覧から開き直してください。';
    loading.value = false;
    return;
  }
  try {
    const [userDoc, recvSnap, paySnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDocs(query(collection(db, 'transactions'), where('paidToId', '==', myUid))),
      getDocs(query(collection(db, 'transactions'), where('paidById', '==', myUid))),
    ]);
    if (version !== loadVersion) return;
    if (!userDoc.exists()) throw new Error('friend-not-found');
    const recvList = [], payList = [], histList = [];
    const collect = (snap, type, otherField, target) => snap.forEach(d => {
      const t = d.data();
      if (t[otherField] !== uid) return;
      const item = {
        id: d.id,
        amount: t.amount || 0,
        itemName: t.itemName || 'イベント代',
        eventName: t.eventName || '',
        status: t.status || 'unpaid',
        type,
        createdAt: t.createdAt,
        settlementBatch: t.settlementBatch || null,
        eventId: t.eventId || null,
        eventSettlementPlanId: t.eventSettlementPlanId || null,
        // まとめて精算に予約された取引は、未払い一覧から外して状態を別に見せる
        eventSettlementLabel: eventSettlementStatusLabel(t) || null,
      };
      histList.push(item);
      if (item.status !== 'completed' && !isEventSettlementReserved(t)) target.push(item);
    });
    collect(recvSnap, 'receive', 'paidById', recvList);
    collect(paySnap, 'pay', 'paidToId', payList);
    const toRows = list => collapsePendingBatches(list).map(t => t.isBatchRow
      ? { ...t, itemName: `まとめて精算（${t.settlementBatch.count || 1}件）` }
      : t);
    const shownRecv = toRows(recvList), shownPay = toRows(payList);
    const sum = arr => arr.reduce((s, t) => s + (t.amount || 0), 0);
    histList.sort((a, b) => dateMillis(b.createdAt) - dateMillis(a.createdAt));
    receivableItems.value = shownRecv;
    payableItems.value = shownPay;
    historyItems.value = histList;
    waitingTotal.value = sum(shownRecv);
    unpaidTotal.value = sum(shownPay);
    friend.value = userDoc.data();
  } catch (error) {
    if (version === loadVersion) loadError.value = '取引を読み込めませんでした。通信状況を確認して、もう一度お試しください。';
  } finally {
    if (version === loadVersion) loading.value = false;
  }
};
watch(() => route.query.uid || route.params.uid, () => { loadFriend(); }, { immediate: true });
onUnmounted(() => { loadVersion++; });

// 🌟 フレンド削除 (ダサい confirm と alert を美しいモーダルに！)
const handleDeleteFriend = async () => {
  const friendName = friend.value?.name || route.params.name || 'この相手';
  const friendUid = route.params.uid; 
  const myUid = auth.currentUser?.uid;

  if (!myUid || !friendUid) {
    showModal({ type: 'error', title: 'エラー', message: '相手の情報を確認できませんでした。' });
    return;
  }

  showModal({
    type: 'warning',
    title: 'フレンドから削除しますか？',
    message: `${friendName}さんを、お互いのフレンド一覧から削除します。`,
    showCancel: true,
    confirmText: '削除する',
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, "users", myUid, "friends", friendUid));
        await deleteDoc(doc(db, "users", friendUid, "friends", myUid));

        // 相手のリストからも消えるので、された側にお知らせを届ける
        try {
          await addDoc(collection(db, "notifications"), {
            toUserId: friendUid,
            fromUserId: myUid,
            fromUserName: await getMyName(),
            type: 'friend_removed',
            message: 'フレンド一覧から外れました。もう一度つながるには、フレンド申請を送ってください。',
            isRead: false,
            createdAt: serverTimestamp(),
          });
        } catch (e) { console.error("削除通知の送信に失敗:", e); }

        // 削除成功したら完了モーダルを出して、OKを押したら一覧に戻る
        showModal({
          type: 'success', title: '削除しました', message: `${friendName}さんをフレンド一覧から削除しました。`,
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
.balance-sub--add { border-color: var(--c-brand); color: var(--c-brand); font-weight: var(--fw-bold); }
.balance-sub { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 8px; padding: 10px; border: 1px solid var(--c-line); border-radius: var(--r-md, 10px); background: var(--c-surface); font-size: 13px; color: var(--c-text); cursor: pointer; }
.balance-sub svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.friend-detail-container { min-height: 100%; background: var(--c-bg); }
.scroll-content { padding: 12px var(--pad) 28px; }
button { font: inherit; touch-action: manipulation; }
button:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 3px; }
.btn-trash { width: 44px; height: 44px; display: grid; place-items: center; color: var(--c-text-sub); background: transparent; border: 0; }
.btn-trash svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.balance-panel { background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-lg); padding: 20px; box-shadow: var(--shadow-card); }
.balance-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.balance-heading h2 { font-size: 15px; font-weight: var(--fw-bold); }
.balance-heading > span { font-size: 12px; color: var(--c-text-sub); }
.balance-main { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
.balance-direction { font-size: 15px; font-weight: var(--fw-bold); }
.balance-amount { font-size: 34px; font-weight: var(--fw-black); line-height: 1.25; letter-spacing: -.01em; overflow-wrap: anywhere; min-width: 0; }
.balance-breakdown { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); margin: 20px 0 0; gap: 8px; }
.balance-breakdown > div { border-radius: var(--r-sm); padding: 12px; min-width: 0; }
.receive-breakdown { background: var(--c-receive-weak); }
.pay-breakdown { background: var(--c-pay-weak); }
.balance-breakdown dt { font-size: 12px; font-weight: var(--fw-bold); color: var(--c-text); margin-bottom: 4px; }
.balance-breakdown dd { font-size: 18px; font-weight: var(--fw-black); margin: 0; overflow-wrap: anywhere; }
.balance-cta { width: 100%; border: 0; border-radius: var(--r-pill); padding: 13px 18px; margin-top: 16px; min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: white; background: var(--c-brand); font-size: 15px; font-weight: var(--fw-bold); text-align: left; cursor: pointer; }
.balance-cta:active { background: var(--c-brand-deep); }
.balance-cta svg, .ledger-right > svg { width: 16px; height: 16px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.balance-note { font-size: 12px; color: var(--c-text-sub); line-height: 1.7; margin: 12px 0 0; }
.blue-text { color: var(--c-receive); }
.orange-text { color: #b45309; }
.history-section { margin-top: 28px; }
.section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.section-title h2 { font-size: 15px; font-weight: var(--fw-bold); }
.history-title-actions { display: flex; align-items: center; gap: 10px; }
.history-title-actions > span { font-size: 12px; color: var(--c-text-sub); white-space: nowrap; }
.history-sort-button { min-height: 40px; padding: 8px 10px; border: 1px solid var(--c-line-bold); border-radius: 999px; background: var(--c-surface); color: var(--c-text-sub); display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: var(--fw-bold); cursor: pointer; white-space: nowrap; }
.history-sort-button svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; transition: transform .15s ease; }
.history-sort-button svg.oldest { transform: rotate(180deg); }
.history-sort-button:active { transform: scale(.98); }
.ledger-list { display: flex; flex-direction: column; gap: 8px; }
.ledger-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; width: 100%; min-height: 80px; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-md); box-shadow: var(--shadow-sm); text-align: left; color: var(--c-ink); cursor: pointer; }
.ledger-row:active { background: var(--c-surface-2); }
.ledger-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.ledger-name { font-size: 15px; font-weight: var(--fw-bold); line-height: 1.5; overflow-wrap: anywhere; }
.ledger-date, .ledger-event { font-size: 12px; color: var(--c-text-sub); line-height: 1.5; overflow-wrap: anywhere; }
.ledger-status { font-size: 12px; line-height: 1.5; color: var(--c-text-sub); }
.status-action { color: var(--c-brand-deep); font-weight: var(--fw-bold); }
.status-action::before { content: ''; display: inline-block; width: 5px; height: 5px; background: currentColor; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.status-done::before { content: '✓'; margin-right: 4px; }
.ledger-right { display: flex; align-items: center; gap: 8px; max-width: 48%; min-width: 0; }
.ledger-right > svg { color: var(--c-text-sub); }
.history-money strong { font-size: 16px; font-weight: var(--fw-black); overflow-wrap: anywhere; min-width: 0; }
.history-money { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 0; text-align: right; }
.history-money > span { font-size: 11px; font-weight: var(--fw-bold); }
.history-month { margin-bottom: 20px; }
.history-month h2 { font-size: 13px; font-weight: var(--fw-medium); color: var(--c-text-sub); margin: 0 0 8px; }
.history-filter { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; margin: -4px 0 16px; border-radius: var(--r-pill); background: var(--c-surface-2); }
.history-filter-button { min-width: 0; min-height: 42px; padding: 8px 4px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--c-text-sub); display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; font-weight: var(--fw-bold); cursor: pointer; }
.history-filter-button strong { font-size: 12px; }
.history-filter-button.active { color: var(--c-brand-strong); background: var(--c-surface); box-shadow: var(--shadow-sm); }
.history-filter-button:active { transform: scale(.98); }
.history-subfilter { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
.history-subfilter-button { min-height: 40px; padding: 8px 11px; border: 1px solid var(--c-line-bold); border-radius: 999px; background: var(--c-surface); color: var(--c-text-sub); display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: var(--fw-bold); cursor: pointer; }
.history-subfilter-button strong { font-size: 11px; }
.history-subfilter-button.active { color: var(--c-brand-deep); border-color: var(--c-brand); background: var(--c-brand-weak); }
.history-subfilter-button:active { transform: scale(.98); }
.empty-note, .load-state { font-size: 13px; color: var(--c-text-sub); line-height: 1.8; padding: 16px 0; }
.load-state { padding: 28px var(--pad); }
.retry-button { display: block; margin-top: 12px; border: 1px solid var(--c-line-bold); background: white; padding: 10px 16px; border-radius: var(--r-sm); color: var(--c-brand-strong); }
@media (max-width: 360px) { .balance-panel { padding: 16px; } .balance-breakdown > div { padding: 10px; } .balance-amount { font-size: 28px; } .ledger-row { padding: 14px 12px; gap: 8px; } .ledger-right { gap: 4px; } }
</style>
