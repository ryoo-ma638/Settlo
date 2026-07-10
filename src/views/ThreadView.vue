<template>
  <div class="thread">
    <PageHeader :title="label" />

    <main ref="scrollArea" class="thread__body">
      <div v-if="loading" class="thread__empty">読み込み中…</div>
      <template v-else>
        <p class="thread__hint">この「{{ label }}」についてのやりとりです。</p>
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg"
          :class="m.fromUid === myUid ? 'msg--mine' : 'msg--theirs'"
        >
          <span v-if="m.fromUid !== myUid" class="msg__name">{{ m.fromName || '相手' }}</span>
          <div class="msg__bubble">{{ m.text }}</div>
          <span v-if="m.id === lastReadMineId" class="msg__read">既読</span>
        </div>
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
import { useRoute } from 'vue-router';
import { db, auth } from '@/firebase';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion, increment,
} from 'firebase/firestore';
import { computed } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { ensureThread } from '@/lib/thread';
import { logApprovalBoth } from '@/lib/approvalLog';

// クイック返信の定型文
const QUICK_REPLIES = ['ありがとう！', '確認しました', 'もう少し待って', 'OKです'];

const route = useRoute();
const threadId = route.params.id;
const label = ref(route.query.label || '取引の件');
const otherUid = ref(route.query.other || '');
const otherName = ref(route.query.otherName || '相手');
const eventId = route.query.eventId || null;

const myUid = auth.currentUser?.uid || '';
const myName = ref(auth.currentUser?.displayName || 'あなた');

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
const canApprove = computed(() => txData.value && txData.value.status === 'awaiting_approval' && txData.value.paidToId === myUid);

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
  } catch (e) { console.error('承認エラー:', e); }
  finally { approving.value = false; }
};
const rejectTx = async () => {
  if (!txId || approving.value) return;
  approving.value = true;
  try {
    await updateDoc(doc(db, 'transactions', txId), { status: 'unpaid' });
    if (otherUid.value) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: otherUid.value, type: 'approval_rejected',
        message: '承認リクエストが拒否されました。もう一度お支払い手続きをしてください。',
        transactionId: txId, fromUserId: myUid, fromUserName: myName.value,
        isRead: false, createdAt: serverTimestamp(),
      });
    }
    await clearApprovalNotif();
    await logApprovalBoth({ myUid, myName: myName.value, otherUid: otherUid.value, otherName: otherName.value, kind: 'payment', outcome: 'rejected', itemName: txData.value?.itemName || '', amount: txData.value?.amount || 0 });
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
    try { const me = await getDoc(doc(db, 'users', myUid)); if (me.exists() && me.data().name) myName.value = me.data().name; } catch (e) {}

    await ensureThread(threadId, { myUid, myName: myName.value, otherUid: otherUid.value, otherName: otherName.value, label: label.value, eventId });
    // この会話を開いたので自分の未読を0に
    try { await updateDoc(doc(db, 'threads', threadId), { [`unread.${myUid}`]: 0 }); } catch (e) {}

    // 承認待ちの取引なら、その状態を購読して承認/拒否バーを出す
    if (txId) {
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

onUnmounted(() => { if (unsub) unsub(); if (unsubTx) unsubTx(); });

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
      await updateDoc(doc(db, 'threads', threadId), {
        lastMessage: text, updatedAt: serverTimestamp(),
        [`unread.${otherUid.value}`]: increment(1), // 相手の未読を+1
        [`unread.${myUid}`]: 0,                      // 自分の未読は0
        hiddenBy: [],                                // 新しいメッセージが来たら両者の非表示を解除
      });
    } catch (e) {}
    // 相手へ「〜の件で返信」をお知らせ
    if (otherUid.value) {
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
