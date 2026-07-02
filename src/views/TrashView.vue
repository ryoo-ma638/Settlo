<template>
  <div class="screen">
    <PageHeader title="ゴミ箱" fallback="/mypage" />

    <div class="ttabs">
      <button class="ttab" :class="{ 'is-on': tab === 'event' }" @click="tab = 'event'">
        <svg class="ttab__icon" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>
        <span>イベント</span>
        <span v-if="eventItems.length" class="ttab__cnt">{{ eventItems.length }}</span>
      </button>
      <button class="ttab" :class="{ 'is-on': tab === 'tx' }" @click="tab = 'tx'">
        <svg class="ttab__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M9.2 9.8h4.2a1.8 1.8 0 1 1 0 3.6H10a1.9 1.9 0 1 0 0 3.8h4.6"/></svg>
        <span>取引</span>
        <span v-if="txItems.length" class="ttab__cnt">{{ txItems.length }}</span>
      </button>
      <button class="ttab" :class="{ 'is-on': tab === 'pending' }" @click="tab = 'pending'">
        <svg class="ttab__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
        <span>保留</span>
        <span v-if="pendingItems.length" class="ttab__cnt">{{ pendingItems.length }}</span>
      </button>
    </div>

    <p class="hint">
      {{ tab === 'pending' ? '相手の承認を待っている項目です。' : 'ここに入って7日たつと自動で消えます。' }}
    </p>

    <!-- イベント / 取引 タブ（削除・完了したもの） -->
    <div v-if="tab === 'event' || tab === 'tx'" class="list">
      <div v-if="currentItems.length === 0" class="empty">
        <span class="empty__icon">🗑️</span>
        <p>{{ tab === 'event' ? '削除したイベントはありません' : '削除・完了した取引はありません' }}</p>
      </div>

      <div v-for="item in currentItems" :key="item.id" class="tcard">
        <div class="tcard__head">
          <span class="tcard__badge" :class="item.type === 'event' ? 'is-event' : 'is-pay'">{{ typeLabel(item.type) }}</span>
          <span class="tcard__days" :class="{ 'is-soon': daysLeft(item) <= 2 }">あと{{ daysLeft(item) }}日</span>
        </div>
        <p class="tcard__ttl">{{ item.type === 'event' ? item.eventName : item.itemName }}</p>
        <p class="tcard__meta">
          <template v-if="item.type === 'event'">ジャンル：{{ item.eventTag || 'その他' }}</template>
          <template v-else><b class="yen">¥{{ (item.amount || 0).toLocaleString() }}</b><span class="sep">/</span>{{ item.eventName }}</template>
        </p>
        <div class="tcard__actions">
          <button v-if="item.type === 'event'" class="btn-brand act" @click="restoreEvent(item)">元に戻す</button>
          <button v-else-if="item.type === 'payment'" class="btn-brand act" @click="restorePayment(item)">元に戻す</button>
          <button v-else class="btn-brand act" @click="askRestoreSettlement(item)">未精算に戻す</button>
          <button class="btn-outline act" @click="askDeleteForever(item)">完全に削除</button>
        </div>
      </div>
    </div>

    <!-- 保留タブ（相手の承認待ち） -->
    <div v-else class="list">
      <div v-if="pendingItems.length === 0" class="empty">
        <span class="empty__icon">⏳</span>
        <p>保留中のものはありません</p>
      </div>

      <div v-for="item in pendingItems" :key="item.id" class="tcard tcard--wait">
        <div class="tcard__head">
          <span class="tcard__badge is-wait">承認待ち</span>
        </div>
        <p class="tcard__ttl">{{ item.itemName }}</p>
        <p class="tcard__meta"><b class="yen">¥{{ (item.amount || 0).toLocaleString() }}</b><span class="sep">/</span>{{ item.eventName }}</p>
        <p class="tcard__note">相手（{{ counterpartyNames(item) }}）の承認を待っています</p>
        <div class="tcard__actions">
          <button class="btn-outline act" @click="askCancelPending(item)">依頼を取り消す</button>
        </div>
      </div>
    </div>

    <BaseModal
      :show="alertState.show"
      :type="alertState.type"
      :title="alertState.title"
      :message="alertState.message"
      :showCancel="alertState.showCancel"
      :confirmText="alertState.confirmText"
      :cancelText="alertState.cancelText"
      @confirm="handleConfirm"
      @cancel="alertState.show = false"
      @close="alertState.show = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { db, auth } from '@/firebase';
import {
  collection, query, orderBy, onSnapshot, doc, getDoc,
  updateDoc, deleteDoc, addDoc, serverTimestamp, arrayRemove, increment
} from 'firebase/firestore';
import PageHeader from '@/components/PageHeader.vue';
import BaseModal from '@/components/BaseModal.vue';

const tab = ref('event');
const items = ref([]);
const myName = ref('メンバー');
let unsub = null;

const trashedItems = computed(() => items.value.filter(i => i.status !== 'pending'));
const pendingItems = computed(() => items.value.filter(i => i.status === 'pending'));
// イベントと取引を分ける
const eventItems = computed(() => trashedItems.value.filter(i => i.type === 'event'));
const txItems = computed(() => trashedItems.value.filter(i => i.type !== 'event'));
const currentItems = computed(() => (tab.value === 'event' ? eventItems.value : txItems.value));

const daysLeft = (item) => {
  const ms = item.trashedAt?.toMillis ? item.trashedAt.toMillis() : Date.now();
  const left = 7 - Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  return Math.max(0, left);
};
const counterpartyNames = (item) => (item.counterparties || []).map(c => c.name).join('・') || '相手';
const typeLabel = (t) => (t === 'event' ? 'イベント' : (t === 'payment' ? '支払い' : '決済'));

// ---- 確認ダイアログ ----
const alertState = reactive({ show: false, type: 'warning', title: '', message: '', showCancel: true, confirmText: 'はい', cancelText: 'いいえ', onConfirm: null });
const askConfirm = (title, message, onConfirm, opts = {}) => {
  Object.assign(alertState, {
    type: opts.type || 'warning', title, message, showCancel: true,
    confirmText: opts.confirmText || 'はい', cancelText: opts.cancelText || 'いいえ', onConfirm, show: true,
  });
};
const handleConfirm = () => { const cb = alertState.onConfirm; alertState.show = false; if (cb) cb(); };

// ---- イベントを元に戻す ----
const restoreEvent = async (item) => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    // 自分の非表示を解除
    await updateDoc(doc(db, 'events', item.eventId), { hiddenBy: arrayRemove(myUid) });
    // 他の参加者に「復元しました」とお知らせ
    try {
      const ev = await getDoc(doc(db, 'events', item.eventId));
      const parts = ev.exists() ? (ev.data().participants || []) : [];
      for (const uid of parts) {
        if (uid === myUid) continue;
        await addDoc(collection(db, 'notifications'), {
          toUserId: uid, type: 'event_restored',
          eventId: item.eventId, eventName: item.eventName || '',
          fromUserId: myUid, fromUserName: myName.value,
          isRead: false, createdAt: serverTimestamp(),
        });
      }
    } catch (e) { console.error('復元通知エラー:', e); }
    await deleteDoc(doc(db, 'users', myUid, 'trash', item.id));
  } catch (e) { console.error('イベント復元エラー:', e); }
};

// ---- 削除した支払いを元に戻す（取引・履歴を作り直す） ----
const restorePayment = async (item) => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    const eventId = item.eventId;
    const newTxIds = [];
    for (const tx of (item.transactionSnapshots || [])) {
      const ref = await addDoc(collection(db, 'transactions'), { ...tx, createdAt: serverTimestamp() });
      newTxIds.push(ref.id);
    }
    const hs = item.historySnapshot || {};
    await addDoc(collection(db, 'events', eventId, 'history'), {
      ...hs, transactionIds: newTxIds, status: 'unpaid', timestamp: serverTimestamp(),
    });
    await updateDoc(doc(db, 'events', eventId), { totalAmount: increment(Number(item.amount) || 0) });
    await deleteDoc(doc(db, 'users', myUid, 'trash', item.id));
  } catch (e) { console.error('支払い復元エラー:', e); }
};

// ---- 決済を未精算に戻す（相手の承認待ちへ） ----
const askRestoreSettlement = (item) => {
  askConfirm(
    '未精算に戻しますか？',
    `「${item.itemName}」を未精算に戻すには相手の承認が必要です。承認されるまで「保留」に入ります。`,
    () => requestSettlementRestore(item),
    { confirmText: '承認を依頼する', cancelText: 'やめる' }
  );
};
const requestSettlementRestore = async (item) => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    await updateDoc(doc(db, 'users', myUid, 'trash', item.id), { status: 'pending' });
    for (const c of (item.counterparties || [])) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: c.uid, type: 'settlement_restore_request',
        eventId: item.eventId || null, eventName: item.eventName || '',
        historyId: item.historyId || null, itemName: item.itemName || '決済',
        amount: item.amount || 0, transactionIds: item.transactionIds || [],
        fromUserId: myUid, fromUserName: myName.value,
        isRead: false, createdAt: serverTimestamp(),
      });
    }
  } catch (e) { console.error('未精算戻し依頼エラー:', e); }
};

// ---- 保留の依頼を取り消す ----
const askCancelPending = (item) => {
  askConfirm('依頼を取り消しますか？', `「${item.itemName}」を未精算に戻す依頼を取り消します。`, async () => {
    const myUid = auth.currentUser?.uid;
    try { await deleteDoc(doc(db, 'users', myUid, 'trash', item.id)); } catch (e) { console.error(e); }
  }, { confirmText: '取り消す', cancelText: 'やめる' });
};

// ---- 完全に削除（復元できなくする） ----
const askDeleteForever = (item) => {
  askConfirm(
    '完全に削除しますか？',
    item.type === 'event'
      ? 'このイベントを自分の画面から完全に消します（もう元に戻せません）。相手の画面には残ります。'
      : 'この決済を完了で確定します（もう未精算には戻せません）。',
    async () => {
      const myUid = auth.currentUser?.uid;
      try { await deleteDoc(doc(db, 'users', myUid, 'trash', item.id)); } catch (e) { console.error(e); }
    },
    { type: 'error', confirmText: '完全に削除', cancelText: 'やめる' }
  );
};

onMounted(() => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  getDoc(doc(db, 'users', myUid)).then(md => {
    if (md.exists() && md.data().name) myName.value = md.data().name;
    else myName.value = auth.currentUser?.displayName || 'メンバー';
  }).catch(() => {});
  const q = query(collection(db, 'users', myUid, 'trash'), orderBy('trashedAt', 'desc'));
  unsub = onSnapshot(q, (snap) => {
    items.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, (err) => { if (err?.code !== 'permission-denied') console.error('ゴミ箱の読み込みエラー:', err); });
});
onUnmounted(() => { if (unsub) unsub(); });
</script>

<style scoped>
.screen { padding-bottom: 40px; }

/* タブ（はっきり見える大きめボタン） */
.ttabs {
  display: flex;
  gap: 8px;
  margin: 14px var(--pad) 12px;
}
.ttab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px 10px;
  border-radius: var(--r-lg, 16px);
  background: var(--c-surface);
  border: 1.5px solid var(--c-line, #e5e8eb);
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: var(--fw-bold);
  position: relative;
  transition: all 0.15s ease;
}
.ttab__icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ttab.is-on {
  background: var(--c-brand);
  border-color: var(--c-brand);
  color: #fff;
  box-shadow: 0 4px 12px rgba(16, 145, 90, 0.28);
}
.ttab:active { transform: scale(0.97); }
.ttab__cnt {
  position: absolute;
  top: -7px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--c-danger);
  color: #fff;
  font-size: 11px;
  font-weight: var(--fw-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c-bg, #fff);
}

.hint { margin: 0 var(--pad) 14px; font-size: 12px; color: var(--c-text-sub); line-height: 1.5; }
.list { padding: 0 var(--pad); display: flex; flex-direction: column; gap: 12px; }

/* 空表示 */
.empty { text-align: center; padding: 48px 20px; color: var(--c-text-sub); }
.empty__icon { font-size: 34px; display: block; margin-bottom: 10px; opacity: 0.7; }
.empty p { margin: 0; font-size: 14px; }

/* カード */
.tcard {
  background: var(--c-surface);
  border: 1px solid var(--c-line, #eef0f2);
  border-radius: var(--r-lg, 16px);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15,23,42,0.04));
}
.tcard--wait { border-color: #fde9c8; background: #fffdf8; }

.tcard__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tcard__badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: var(--fw-bold); }
.tcard__badge.is-event { background: var(--c-brand-weak); color: var(--c-brand); }
.tcard__badge.is-pay { background: #eef4ff; color: #3b6fd4; }
.tcard__badge.is-wait { background: #fff4e0; color: var(--c-pay); }

.tcard__days { font-size: 11px; font-weight: var(--fw-bold); color: var(--c-text-sub); background: var(--c-surface-2, #f4f5f7); padding: 3px 9px; border-radius: 999px; }
.tcard__days.is-soon { background: #fdecec; color: var(--c-danger); }

.tcard__ttl { margin: 0; font-weight: var(--fw-bold); font-size: 16px; color: var(--c-ink); word-break: break-word; line-height: 1.35; }
.tcard__meta { margin: 3px 0 0; font-size: 13px; color: var(--c-text-sub); }
.tcard__meta .yen { color: var(--c-ink); font-weight: var(--fw-bold); }
.tcard__meta .sep { margin: 0 7px; color: var(--c-line, #d7dbe0); }
.tcard__note { margin: 8px 0 0; font-size: 12px; color: var(--c-pay); }

.tcard__actions { display: flex; gap: 8px; margin-top: 14px; }
.act { padding: 10px 14px; font-size: 13.5px; flex: 1; border-radius: var(--r-md, 12px); font-weight: var(--fw-bold); }
</style>
