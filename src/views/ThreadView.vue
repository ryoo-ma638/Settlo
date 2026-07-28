<template>
  <div class="thread">
    <PageHeader :title="label" />

    <main ref="scrollArea" class="thread__body">
      <div v-if="loading" class="thread__empty">読み込み中…</div>
      <template v-else>
        <!-- グループ（みんなの精算）の進捗：誰が払ったか・X/Y -->
        <section v-if="isGroup" class="gprog">
          <div class="gprog__head">
            <span class="gprog__count">{{ progressTotal }}人中 {{ progressDone }}人が精算済み</span>
            <button class="gprog__link" @click="goToPayScreen">支払い画面へ ›</button>
          </div>
          <div class="gprog__bar"><div class="gprog__fill" :style="{ width: progressTotal ? (progressDone / progressTotal * 100) + '%' : '0%' }"></div></div>
          <p class="gprog__split">割り勘の内訳（1人ずつの負担額）</p>
          <div class="gprog__people">
            <span v-for="p in payStatus" :key="p.uid" class="gperson" :class="{ 'is-done': p.done }">
              <svg v-if="p.done" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
              <svg v-else viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/></svg>
              <span class="gperson__name">{{ p.name }}</span>
              <span class="gperson__amt tnum">¥{{ (p.amount || 0).toLocaleString() }}</span>
              <span class="gperson__tag">{{ p.done ? '精算済み' : '未払い' }}</span>
            </span>
          </div>
        </section>

        <p v-else class="thread__hint">この「{{ label }}」についてのやりとりです。</p>
        <button v-if="!isGroup && txId" class="thread__paylink" @click="goToPayScreen">この件の支払い画面へ ›</button>

        <template v-for="m in messages" :key="m.id">
          <!-- システム行（経緯：催促・支払い・承認・拒否・完了） -->
          <div v-if="m.system" class="sysmsg">{{ m.text }}</div>
          <!-- 通常メッセージ -->
          <div v-else class="msg" :class="m.fromUid === myUid ? 'msg--mine' : 'msg--theirs'">
            <span v-if="m.fromUid !== myUid" class="msg__name">{{ m.fromName || '相手' }}</span>
            <div class="msg__bubble">{{ m.text }}</div>
            <span v-if="m.id === lastReadMineId" class="msg__read">既読</span>
          </div>
        </template>
        <div v-if="messages.length === 0" class="thread__empty">まだメッセージはありません。</div>
      </template>
    </main>

    <div v-if="canApprove" class="thread__approve">
      <p class="thread__approve-text">この支払いはあなたの承認待ちです。内容を確認したら、ここで承認・拒否できます。</p>
      <div class="thread__approve-btns">
        <button class="thread__approve-ok" :disabled="approving" @click="approveTx">承認する</button>
        <button class="thread__approve-ng" :disabled="approving" @click="rejectTx">拒否する</button>
      </div>
    </div>

    <div class="thread__quick">
      <button v-for="q in QUICK_REPLIES" :key="q" class="quick-chip" :disabled="sending" @click="send(q)">{{ q }}</button>
    </div>

    <footer class="thread__compose">
      <textarea
        v-model="draft"
        class="thread__input"
        rows="1"
        maxlength="500"
        placeholder="メッセージを入力"
        @keydown.enter.exact.prevent="send()"
      ></textarea>
      <button class="thread__send" :disabled="!draft.trim() || sending" @click="send()" aria-label="送信">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      </button>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion, increment,
} from 'firebase/firestore';
import { computed } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { ensureThread, resolveThreadForTx, postPaymentEventByTx } from '@/lib/thread';
import { getUserName } from '@/lib/userName';
import { logApprovalBoth } from '@/lib/approvalLog';
import { findBatchApprovalRequests, revertCounterTransactions, COUNTER_REVERT_TEXT } from '@/lib/settlement';

// クイック返信の定型文
const QUICK_REPLIES = ['ありがとう！', '確認しました', 'もう少し待って', 'OKです'];

const route = useRoute();
const router = useRouter();
const threadId = route.params.id;
const label = ref(route.query.label || '取引の件');
const otherUid = ref(route.query.other || '');
const otherName = ref(route.query.otherName || '相手');
const eventId = route.query.eventId || null;

const myUid = auth.currentUser?.uid || '';
const myName = ref('メンバー'); // 実際の名前は onMounted で users から入れる

const messages = ref([]);
const draft = ref('');
const loading = ref(true);
const sending = ref(false);
const scrollArea = ref(null);
let unsub = null;

// 自分のメッセージのうち、相手が読んだ最後の1件（そこに「既読」を出す）
const lastReadMineId = computed(() => {
  let id = null;
  for (const m of messages.value) {
    if (m.fromUid === myUid && (m.readBy || []).includes(otherUid.value)) id = m.id;
  }
  return id;
});

// 承認待ちの取引（返信画面から承認/拒否できるように）
const txId = route.query.tx || '';
const txData = ref(null);
let unsubTx = null;
const approving = ref(false);
const canApprove = computed(() => !isGroup.value && txData.value && txData.value.status === 'awaiting_approval' && txData.value.paidToId === myUid);

// 🌟 グループ（支払い1件＝みんなの精算）チャットの状態
const isGroup = ref(false);
const groupParticipants = ref([]);
const payEventId = ref(null);
const progressDone = ref(0);
const progressTotal = ref(0);
const payStatus = ref([]); // 誰が払ったか [{ uid, name, amount, done }]
const payTxs = ref([]);    // この件の取引（支払い画面への遷移に使う）
let unsubPay = null;

const clearApprovalNotif = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'notifications'), where('toUserId', '==', myUid)));
    for (const d of snap.docs) {
      const n = d.data();
      if (n.type === 'approval_request' && n.transactionId === txId) {
        try { await updateDoc(doc(db, 'notifications', d.id), { isRead: true }); } catch (e) {}
      }
    }
  } catch (e) {}
};
const approveTx = async () => {
  if (!txId || approving.value) return;
  approving.value = true;
  try {
    await updateDoc(doc(db, 'transactions', txId), { status: 'completed' });
    if (otherUid.value) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: otherUid.value, type: 'payment_completed',
        message: '支払いが承認され、精算が完了しました。',
        transactionId: txId, fromUserId: myUid, fromUserName: myName.value,
        isRead: false, createdAt: serverTimestamp(),
      });
    }
    await clearApprovalNotif();
    await logApprovalBoth({ myUid, myName: myName.value, otherUid: otherUid.value, otherName: otherName.value, kind: 'payment', outcome: 'approved', itemName: txData.value?.itemName || '', amount: txData.value?.amount || 0 });
    await postPaymentEventByTx(txId, { text: `${otherName.value}さんの支払いを承認し、精算しました`, kind: 'approved', actorUid: myUid });
    await resolveThreadForTx(myUid, otherUid.value, txId); // 解決したのでチャットを消す
  } catch (e) { console.error('承認エラー:', e); }
  finally { approving.value = false; }
};
const rejectTx = async () => {
  if (!txId || approving.value) return;
  approving.value = true;
  try {
    await updateDoc(doc(db, 'transactions', txId), { status: 'unpaid' });
    // 🌟 双方向のまとめ精算なら、相手がその場で完了にした逆方向の取引も未払いに戻す
    let revertedCounter = 0;
    for (const n of await findBatchApprovalRequests(myUid, [txId])) {
      const done = await revertCounterTransactions({
        myUid, otherUid: n.fromUserId, ids: n.counterTransactionIds, skipIds: [txId], text: COUNTER_REVERT_TEXT,
      });
      revertedCounter += done.length;
      try { await updateDoc(doc(db, 'notifications', n.id), { isRead: true }); } catch (e) {}
    }
    if (otherUid.value) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: otherUid.value, type: 'approval_rejected',
        message: revertedCounter
          ? '承認リクエストが拒否されました。双方向の精算がすべて未払いに戻っています。もう一度お手続きできます。'
          : '承認リクエストが拒否されました。もう一度お支払い手続きをしてください。',
        transactionId: txId, fromUserId: myUid, fromUserName: myName.value,
        isRead: false, createdAt: serverTimestamp(),
      });
    }
    await clearApprovalNotif();
    await logApprovalBoth({ myUid, myName: myName.value, otherUid: otherUid.value, otherName: otherName.value, kind: 'payment', outcome: 'rejected', itemName: txData.value?.itemName || '', amount: txData.value?.amount || 0 });
    await postPaymentEventByTx(txId, { text: `${otherName.value}さんの支払いを差し戻しました（未払いに戻りました）`, kind: 'rejected', actorUid: myUid });
  } catch (e) { console.error('拒否エラー:', e); }
  finally { approving.value = false; }
};

const scrollToBottom = () => nextTick(() => {
  const el = scrollArea.value;
  if (el) el.scrollTop = el.scrollHeight;
});

onMounted(async () => {
  if (!myUid || !threadId) { loading.value = false; return; }
  try {
    // 自分の表示名を実データで補完
    myName.value = await getUserName(myUid);

    // 🌟 既存スレッドを読み、グループ（支払い1件）チャットかどうかを判定
    let existingData = null;
    try {
      const existing = await getDoc(doc(db, 'threads', threadId));
      if (existing.exists()) {
        existingData = existing.data();
        const saved = existingData.subjectLabel;
        if (saved && saved !== '取引の件' && (!route.query.label || route.query.label === '取引の件')) label.value = saved;
        // チャット一覧から開いたときは相手UIDが渡ってこないので、参加者から補う
        // （空のまま ensureThread を呼ぶと participants が壊れ、相手の一覧から会話が消える）
        if (!otherUid.value) {
          const found = (existingData.participants || []).find((u) => u && u !== myUid);
          if (found) otherUid.value = found;
        }
        const savedName = existingData.participantNames?.[otherUid.value];
        if (savedName && (!route.query.otherName || otherName.value === '相手')) otherName.value = savedName;
        // グループ判定
        if (existingData.type === 'payment' || (existingData.participants || []).length > 2) {
          isGroup.value = true;
          groupParticipants.value = existingData.participants || [];
          payEventId.value = existingData.eventId || null;
        }
      }
    } catch (e) {}

    // グループチャットは既に存在するので ensureThread（1対1用）は呼ばない
    // 相手が分からないときも作らない（participants が [自分, ''] になるのを防ぐ）
    if (!isGroup.value && otherUid.value) {
      await ensureThread(threadId, { myUid, myName: myName.value, otherUid: otherUid.value, otherName: otherName.value, label: label.value, eventId });
    }
    // この会話を開いたので自分の未読を0に
    try { await updateDoc(doc(db, 'threads', threadId), { [`unread.${myUid}`]: 0 }); } catch (e) {}

    // グループチャット：紐づく取引を購読して進捗（誰が払ったか・X/Y）を出す
    if (isGroup.value && threadId.startsWith('pay-')) {
      const hid = threadId.slice(4);
      const names = existingData?.participantNames || {};
      unsubPay = onSnapshot(query(collection(db, 'transactions'), where('historyId', '==', hid)), (snap) => {
        const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        payTxs.value = txs;
        progressTotal.value = txs.length;
        progressDone.value = txs.filter((t) => (t.status || 'unpaid') === 'completed').length;
        payStatus.value = txs.map((t) => ({ uid: t.paidById, name: names[t.paidById] || '相手', amount: t.amount || 0, done: (t.status || 'unpaid') === 'completed' }));
      }, () => {});
    }

    // 承認待ちの取引なら、その状態を購読して承認/拒否バーを出す（1対1のみ）
    if (txId && !isGroup.value) {
      unsubTx = onSnapshot(doc(db, 'transactions', txId), (d) => { txData.value = d.exists() ? d.data() : null; }, () => {});
    }

    // 最初の一言（お知らせに添えられたメッセージ）を種として1件目に置く（重複しないよう固定ID）
    const seedText = route.query.seedText;
    if (seedText) {
      const seedRef = doc(db, 'threads', threadId, 'messages', 'opening');
      const exists = await getDoc(seedRef);
      if (!exists.exists()) {
        await setDoc(seedRef, {
          fromUid: route.query.seedFrom || otherUid.value,
          fromName: route.query.seedFromName || otherName.value,
          text: seedText,
          createdAt: serverTimestamp(),
          readBy: [route.query.seedFrom || otherUid.value],
        });
      }
    }

    const q = query(collection(db, 'threads', threadId, 'messages'), orderBy('createdAt', 'asc'));
    unsub = onSnapshot(q, (snap) => {
      messages.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      loading.value = false;
      scrollToBottom();
      // 相手のメッセージを既読にする（自分がまだ読んでいないもの）
      snap.docs.forEach((d) => {
        const m = d.data();
        if (m.fromUid !== myUid && !(m.readBy || []).includes(myUid)) {
          updateDoc(d.ref, { readBy: arrayUnion(myUid) }).catch(() => {});
        }
      });
    }, (e) => { console.error('スレッド購読エラー:', e); loading.value = false; });
  } catch (e) {
    console.error('スレッド初期化エラー:', e);
    loading.value = false;
  }
});

onUnmounted(() => { if (unsub) unsub(); if (unsubTx) unsubTx(); if (unsubPay) unsubPay(); });

// この件の「支払いできる画面」へ。イベント詳細ではなく決済詳細（払う/受け取る画面）に飛ばす。
const goToPayScreen = () => {
  if (isGroup.value) {
    // 自分が払う側なら自分の取引の支払い画面へ、受け取る側なら相手の取引（催促/承認）画面へ
    const mine = payTxs.value.find((t) => t.paidById === myUid && (t.status || 'unpaid') !== 'completed');
    if (mine) { router.push(`/payment-detail/unpaid-${mine.id}`); return; }
    const owed = payTxs.value.find((t) => t.paidToId === myUid && (t.status || 'unpaid') !== 'completed');
    if (owed) { router.push(`/payment-detail/waiting-${owed.id}`); return; }
    router.push('/payment'); // 全部完了なら支払い画面トップへ
    return;
  }
  if (txId) {
    const prefix = txData.value && txData.value.paidToId === myUid ? 'waiting' : 'unpaid';
    router.push(`/payment-detail/${prefix}-${txId}`);
  }
};

const send = async (preset) => {
  const usePreset = typeof preset === 'string';
  const text = (usePreset ? preset : draft.value).trim();
  if (!text || sending.value || !myUid) return;
  sending.value = true;
  if (!usePreset) draft.value = '';
  try {
    await addDoc(collection(db, 'threads', threadId, 'messages'), {
      fromUid: myUid, fromName: myName.value, text,
      createdAt: serverTimestamp(), readBy: [myUid],
    });
    try {
      const patch = { lastMessage: text, updatedAt: serverTimestamp(), [`unread.${myUid}`]: 0, hiddenBy: [] };
      if (isGroup.value) {
        // グループは自分以外の全参加者の未読を+1
        groupParticipants.value.forEach((u) => { if (u && u !== myUid) patch[`unread.${u}`] = increment(1); });
      } else {
        patch[`unread.${otherUid.value}`] = increment(1); // 相手の未読を+1
      }
      await updateDoc(doc(db, 'threads', threadId), patch);
    } catch (e) {}
    // 相手へ「〜の件で返信」をお知らせ（1対1のみ・グループは通知を増やしすぎない）
    if (otherUid.value && !isGroup.value) {
      try {
        await addDoc(collection(db, 'notifications'), {
          toUserId: otherUid.value, type: 'thread_reply',
          threadId, threadLabel: label.value,
          fromUserId: myUid, fromUserName: myName.value,
          isRead: false, createdAt: serverTimestamp(),
        });
      } catch (e) {}
    }
  } catch (e) {
    console.error('メッセージ送信エラー:', e);
    if (!usePreset) draft.value = text; // 失敗時は入力を戻す
  } finally {
    sending.value = false;
  }
};
</script>

<style scoped>
/* #app(スマホ=100dvh / PC=100dvh-48px・overflow:hidden)にぴったり収める。
   100dvh固定だとPCで下48pxがはみ出て入力欄が切れるため 100% にする。 */
.thread { display: flex; flex-direction: column; height: 100%; background: var(--c-bg); }
.thread__body { flex: 1; overflow-y: auto; padding: 12px var(--pad) 16px; display: flex; flex-direction: column; gap: 10px; }
.thread__hint { text-align: center; font-size: 12px; color: var(--c-text-faint); font-weight: var(--fw-medium); margin: 4px 0 10px; }
.thread__empty { text-align: center; color: var(--c-text-faint); font-size: 14px; padding: 32px 0; }

/* この件の支払い画面へ（1対1） */
.thread__paylink {
  align-self: center; margin: 2px 0 8px; padding: 7px 16px;
  background: var(--c-brand-weak); color: var(--c-brand-strong);
  border-radius: var(--r-pill); font-size: 12.5px; font-weight: var(--fw-bold);
}

/* グループ（みんなの精算）の進捗カード */
.gprog { background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-lg); padding: 14px; margin-bottom: 8px; }
.gprog__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.gprog__count { font-size: 13px; font-weight: var(--fw-black); color: var(--c-ink); }
.gprog__link { font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand-strong); flex-shrink: 0; }
.gprog__bar { height: 7px; background: var(--c-surface-2); border-radius: 999px; overflow: hidden; }
.gprog__fill { height: 100%; background: var(--c-brand); border-radius: 999px; transition: width 0.3s ease; }
.gprog__split { font-size: 11px; color: var(--c-text-faint); font-weight: var(--fw-bold); margin: 12px 0 6px; }
.gprog__people { display: flex; flex-direction: column; gap: 2px; }
.gperson { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: 13px; font-weight: var(--fw-bold); color: var(--c-text-sub); }
.gperson.is-done { color: var(--c-brand-strong); }
.gperson svg { width: 16px; height: 16px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.gperson__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gperson__amt { flex-shrink: 0; font-size: 14px; font-weight: var(--fw-black); color: var(--c-ink); }
.gperson__tag { flex-shrink: 0; font-size: 10.5px; font-weight: var(--fw-bold); padding: 2px 8px; border-radius: 999px; background: var(--c-surface-2); color: var(--c-text-sub); }
.gperson.is-done .gperson__tag { background: var(--c-brand-weak); color: var(--c-brand-strong); }

/* システム行（経緯） */
.sysmsg {
  align-self: center; max-width: 90%; text-align: center;
  font-size: 12px; font-weight: var(--fw-medium); color: var(--c-text-sub);
  background: var(--c-surface-2); border-radius: 12px; padding: 6px 14px; margin: 2px 0;
}

.msg { display: flex; flex-direction: column; max-width: 78%; }
.msg--mine { align-self: flex-end; align-items: flex-end; }
.msg--theirs { align-self: flex-start; align-items: flex-start; }
.msg__name { font-size: 11px; color: var(--c-text-sub); font-weight: var(--fw-bold); margin: 0 4px 3px; }
.msg__bubble {
  padding: 10px 14px; border-radius: var(--r-lg); font-size: 14px; line-height: 1.5;
  font-weight: var(--fw-medium); white-space: pre-wrap; word-break: break-word;
}
.msg--mine .msg__bubble { background: var(--c-brand); color: #fff; border-bottom-right-radius: 6px; }
.msg--theirs .msg__bubble { background: var(--c-surface); color: var(--c-ink); border-bottom-left-radius: 6px; box-shadow: var(--shadow-card); }
.msg__read { font-size: 10px; color: var(--c-text-faint); font-weight: var(--fw-bold); margin: 3px 4px 0; }

.thread__approve { padding: 10px var(--pad); background: var(--c-brand-weak); border-top: 1px solid var(--c-line); }
.thread__approve-text { margin: 0 0 8px; font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand-strong, var(--c-brand)); }
.thread__approve-btns { display: flex; gap: 8px; }
.thread__approve-ok, .thread__approve-ng { flex: 1; padding: 11px; border-radius: var(--r-md); font-size: 14px; font-weight: var(--fw-bold); border: none; }
.thread__approve-ok { background: var(--c-brand); color: #fff; }
.thread__approve-ng { background: var(--c-surface); color: var(--c-text-sub); border: 1px solid var(--c-line-bold); }
.thread__approve-ok:disabled, .thread__approve-ng:disabled { opacity: 0.5; }

.thread__quick { display: flex; gap: 8px; overflow-x: auto; padding: 8px var(--pad); background: var(--c-surface); border-top: 1px solid var(--c-line); }
.quick-chip {
  flex-shrink: 0; background: var(--c-brand-weak); color: var(--c-brand);
  border: 1px solid var(--c-brand-tint); border-radius: var(--r-pill);
  padding: 7px 14px; font-size: 13px; font-weight: var(--fw-bold); cursor: pointer; white-space: nowrap;
}
.quick-chip:active { transform: scale(0.96); }
.quick-chip:disabled { opacity: 0.5; }

.thread__compose {
  display: flex; align-items: flex-end; gap: 8px;
  padding: 10px var(--pad) calc(10px + env(safe-area-inset-bottom, 0));
  background: var(--c-surface);
}
.thread__input {
  flex: 1; box-sizing: border-box; resize: none; max-height: 120px;
  background: var(--c-surface-2); border: 1px solid var(--c-line-strong);
  border-radius: var(--r-lg); padding: 10px 14px; font-size: 14px; font-family: inherit;
  color: var(--c-ink); outline: none;
}
.thread__input:focus { border-color: var(--c-brand); }
.thread__send {
  flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; border: none;
  background: var(--c-brand); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.thread__send:disabled { opacity: 0.4; }
.thread__send svg { width: 20px; height: 20px; }
</style>
