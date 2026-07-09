<template>
  <div class="pend">
    <PageHeader title="承認待ち" fallback="/" />

    <main class="pend__body">
      <!-- あなたの承認待ち（相手が「支払った」と申請中・あなたが承認する） -->
      <section class="pend__sec">
        <h2 class="pend__title">あなたの承認待ち</h2>
        <div v-if="toApprove.length === 0" class="pend__empty">承認待ちの項目はありません</div>
        <button v-for="t in toApprove" :key="t.id" class="prow" @click="openTx(t)">
          <span class="prow__badge prow__badge--wait">承認待ち</span>
          <span class="prow__main">
            <span class="prow__name">{{ t.opponentName }}さんの支払い</span>
            <span class="prow__sub">{{ t.label }}</span>
          </span>
          <span class="prow__amt tnum">¥{{ (t.amount || 0).toLocaleString() }}</span>
        </button>
      </section>

      <!-- 相手の承認待ち（あなたが「支払った」と申請済み・相手の承認待ち） -->
      <section class="pend__sec">
        <h2 class="pend__title">相手の承認待ち</h2>
        <div v-if="waitingOther.length === 0" class="pend__empty">相手の承認待ちはありません</div>
        <button v-for="t in waitingOther" :key="t.id" class="prow" @click="openTx(t)">
          <span class="prow__badge prow__badge--sent">申請中</span>
          <span class="prow__main">
            <span class="prow__name">{{ t.opponentName }}さんへの支払い</span>
            <span class="prow__sub">{{ t.label }}</span>
          </span>
          <span class="prow__amt tnum">¥{{ (t.amount || 0).toLocaleString() }}</span>
        </button>
      </section>

      <!-- 承認・拒否の履歴（消えずに残る） -->
      <section class="pend__sec">
        <h2 class="pend__title">承認・拒否の履歴</h2>
        <div v-if="history.length === 0" class="pend__empty">まだ履歴はありません</div>
        <div v-for="h in history" :key="h.id" class="hrow">
          <span class="hrow__badge" :class="h.outcome === 'approved' ? 'is-ok' : 'is-ng'">{{ h.outcome === 'approved' ? '承認' : '拒否' }}</span>
          <span class="hrow__text">{{ historyText(h) }}</span>
          <span class="hrow__time">{{ fmtTime(h.createdAt) }}</span>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import PageHeader from '../components/PageHeader.vue';

const router = useRouter();
const myUid = auth.currentUser?.uid || '';
const toApprove = ref([]);   // 自分が承認する
const waitingOther = ref([]); // 相手の承認待ち
const history = ref([]);
const unsubs = [];

const nameCache = {};
const resolveName = async (uid) => {
  if (!uid) return '相手';
  if (nameCache[uid]) return nameCache[uid];
  try { const u = await getDoc(doc(db, 'users', uid)); if (u.exists()) { nameCache[uid] = u.data().name || '相手'; return nameCache[uid]; } } catch (e) {}
  return '相手';
};
const labelOf = (t) => {
  const ev = t.eventName && t.eventName !== t.itemName ? `${t.eventName}・` : '';
  return `${ev}${t.itemName || '取引'}`;
};

const buildList = async (docs, opponentField) => {
  const out = [];
  for (const d of docs) {
    const data = d.data();
    if (data.status !== 'awaiting_approval') continue;
    out.push({ id: d.id, ...data, label: labelOf(data), opponentName: await resolveName(data[opponentField]) });
  }
  return out.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
const historyText = (h) => {
  const kindLabel = h.kind === 'friend' ? 'フレンド申請' : (h.kind === 'settlement' ? '未精算戻し' : '支払い');
  const amt = h.amount ? `（¥${Number(h.amount).toLocaleString()}）` : '';
  const item = h.itemName ? `「${h.itemName}」` : '';
  if (h.role === 'byMe') return `${h.otherName}さんの${kindLabel}${item}${amt}を${h.outcome === 'approved' ? '承認' : '拒否'}しました`;
  return `${h.otherName}さんがあなたの${kindLabel}${item}${amt}を${h.outcome === 'approved' ? '承認' : '拒否'}しました`;
};

const openTx = (t) => {
  const prefix = t.paidToId === myUid ? 'waiting' : 'unpaid';
  router.push(`/payment-detail/${prefix}-${t.id}`);
};

onMounted(() => {
  if (!myUid) return;
  // 自分が受け取る側＝自分が承認する
  unsubs.push(onSnapshot(query(collection(db, 'transactions'), where('paidToId', '==', myUid)), async (snap) => {
    toApprove.value = await buildList(snap.docs, 'paidById');
  }, () => {}));
  // 自分が支払う側＝相手の承認待ち
  unsubs.push(onSnapshot(query(collection(db, 'transactions'), where('paidById', '==', myUid)), async (snap) => {
    waitingOther.value = await buildList(snap.docs, 'paidToId');
  }, () => {}));
  // 承認・拒否の履歴
  unsubs.push(onSnapshot(query(collection(db, 'approvalHistory'), where('userId', '==', myUid)), (snap) => {
    history.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, () => {}));
});
onUnmounted(() => { unsubs.forEach((u) => u && u()); });
</script>

<style scoped>
.pend__body { padding: 8px 0 28px; }
.pend__sec { margin-bottom: 18px; }
.pend__title { font-size: 13px; font-weight: var(--fw-bold); color: var(--c-text-sub); margin: 0 0 6px; padding: 0 var(--pad); }
.pend__empty { font-size: 13px; color: var(--c-text-faint); font-weight: var(--fw-medium); padding: 12px var(--pad); }

.prow {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 13px var(--pad); background: var(--c-surface); border: none;
  border-bottom: 1px solid var(--c-line); text-align: left; cursor: pointer;
}
.prow:active { background: var(--c-surface-2); }
.prow__badge { flex-shrink: 0; font-size: 10px; font-weight: var(--fw-black); padding: 3px 8px; border-radius: 999px; }
.prow__badge--wait { background: var(--c-pay-weak, #fffbeb); color: var(--c-pay-strong); }
.prow__badge--sent { background: var(--c-brand-weak); color: var(--c-brand); }
.prow__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.prow__name { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__sub { font-size: 12px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__amt { flex-shrink: 0; font-size: 15px; font-weight: var(--fw-black); color: var(--c-ink); }

.hrow { display: flex; align-items: center; gap: 10px; padding: 11px var(--pad); border-bottom: 1px solid var(--c-line); }
.hrow__badge { flex-shrink: 0; font-size: 10px; font-weight: var(--fw-black); padding: 3px 8px; border-radius: 999px; }
.hrow__badge.is-ok { background: var(--c-brand-weak); color: var(--c-brand); }
.hrow__badge.is-ng { background: var(--c-danger-weak); color: var(--c-danger); }
.hrow__text { flex: 1; min-width: 0; font-size: 13px; color: var(--c-text); font-weight: var(--fw-medium); }
.hrow__time { flex-shrink: 0; font-size: 11px; color: var(--c-text-faint); }
</style>
