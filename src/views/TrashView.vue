<template>
  <div class="screen">
    <PageHeader title="ゴミ箱" fallback="/mypage" />

    <div class="seg tabs">
      <button class="seg__btn" :class="{ 'seg__btn--active': tab === 'trash' }" @click="tab = 'trash'">
        ゴミ箱<span v-if="trashedItems.length" class="cnt">{{ trashedItems.length }}</span>
      </button>
      <button class="seg__btn" :class="{ 'seg__btn--active': tab === 'pending' }" @click="tab = 'pending'">
        保留<span v-if="pendingItems.length" class="cnt">{{ pendingItems.length }}</span>
      </button>
    </div>

    <p class="hint">ゴミ箱に入って7日たつと自動で消えます。承認待ちのものは「保留」に入ります。</p>

    <!-- ゴミ箱タブ -->
    <div v-if="tab === 'trash'" class="list">
      <div v-if="trashedItems.length === 0" class="empty-box">ゴミ箱は空です</div>

      <div v-for="item in trashedItems" :key="item.id" class="card trash-card">
        <div class="trash-card__main">
          <span class="badge" :class="item.type === 'event' ? 'badge--event' : 'badge--pay'">
            {{ item.type === 'event' ? 'イベント' : '決済' }}
          </span>
          <div class="trash-card__text">
            <p class="ttl">{{ item.type === 'event' ? item.eventName : item.itemName }}</p>
            <p class="sub" v-if="item.type === 'settlement'">¥{{ (item.amount || 0).toLocaleString() }}・{{ item.eventName }}</p>
            <p class="sub" v-else>ジャンル：{{ item.eventTag || 'その他' }}</p>
          </div>
        </div>
        <p class="days">あと{{ daysLeft(item) }}日で自動削除</p>
        <div class="trash-card__actions">
          <button v-if="item.type === 'event'" class="btn-brand sm" @click="restoreEvent(item)">元に戻す</button>
          <button v-else class="btn-brand sm" @click="askRestoreSettlement(item)">未精算に戻す</button>
          <button class="btn-outline sm" @click="askDeleteForever(item)">完全に削除</button>
        </div>
      </div>
    </div>

    <!-- 保留タブ（相手の承認待ち） -->
    <div v-else class="list">
      <div v-if="pendingItems.length === 0" class="empty-box">保留中のものはありません</div>

      <div v-for="item in pendingItems" :key="item.id" class="card trash-card">
        <div class="trash-card__main">
          <span class="badge badge--wait">承認待ち</span>
          <div class="trash-card__text">
            <p class="ttl">{{ item.itemName }}</p>
            <p class="sub">¥{{ (item.amount || 0).toLocaleString() }}・{{ item.eventName }}</p>
          </div>
        </div>
        <p class="days">相手（{{ counterpartyNames(item) }}）の承認を待っています</p>
        <div class="trash-card__actions">
          <button class="btn-outline sm" @click="askCancelPending(item)">依頼を取り消す</button>
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
  updateDoc, deleteDoc, addDoc, serverTimestamp, arrayRemove
} from 'firebase/firestore';
import PageHeader from '@/components/PageHeader.vue';
import BaseModal from '@/components/BaseModal.vue';

const tab = ref('trash');
const items = ref([]);
const myName = ref('メンバー');
let unsub = null;

const trashedItems = computed(() => items.value.filter(i => i.status !== 'pending'));
const pendingItems = computed(() => items.value.filter(i => i.status === 'pending'));

const daysLeft = (item) => {
  const ms = item.trashedAt?.toMillis ? item.trashedAt.toMillis() : Date.now();
  const left = 7 - Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  return Math.max(0, left);
};
const counterpartyNames = (item) => (item.counterparties || []).map(c => c.name).join('・') || '相手';

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
.tabs { margin: 12px var(--pad) 8px; }
.hint { margin: 0 var(--pad) 14px; font-size: 12px; color: var(--c-text-sub); line-height: 1.5; }
.list { padding: 0 var(--pad); display: flex; flex-direction: column; gap: 12px; }

.trash-card { padding: 14px 16px; }
.trash-card__main { display: flex; align-items: flex-start; gap: 10px; }
.trash-card__text { flex: 1; min-width: 0; }
.ttl { margin: 0; font-weight: var(--fw-bold); font-size: 15px; color: var(--c-ink); word-break: break-word; }
.sub { margin: 2px 0 0; font-size: 12px; color: var(--c-text-sub); }
.days { margin: 8px 0 10px; font-size: 12px; color: var(--c-text-sub); }

.badge { flex-shrink: 0; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: var(--fw-bold); }
.badge--event { background: var(--c-brand-weak); color: var(--c-brand); }
.badge--pay { background: #fff7ed; color: var(--c-pay); }
.badge--wait { background: #fffbeb; color: var(--c-pay); }
.cnt { margin-left: 6px; background: var(--c-brand); color: #fff; border-radius: 999px; padding: 0 6px; font-size: 11px; }

.trash-card__actions { display: flex; gap: 8px; }
.sm { padding: 9px 14px; font-size: 13px; flex: 1; }
</style>
