<template>
  <div class="pchats">
    <PageHeader :title="otherName || '相談'" fallback="/chats" />

    <main class="pchats__body">
      <p class="pchats__note">この相手が参加する取引の会話です。複数人の会話も含みます。</p>
      <div v-if="loading" class="pchats__empty">読み込み中…</div>
      <div v-else-if="loadError" class="pchats__empty" role="alert">
        <p>{{ loadError }}</p><button class="retry-button" @click="subscribe">もう一度読み込む</button>
      </div>
      <template v-else>
        <p v-if="actionError" class="pchats__action-error" role="alert">{{ actionError }}</p>
        <div v-for="t in threads" :key="t.id" class="trow">
          <button class="trow__open" @click="open(t)">
            <span class="trow__main">
              <span class="trow__top">
                <span class="trow__label">{{ t.subjectLabel || '取引の件' }}</span>
                <span class="trow__time">{{ fmtTime(t.updatedAt) }}</span>
              </span>
              <span class="trow__msg">{{ t.lastMessage || 'やりとりを開く' }}</span>
              <span class="trow__people">{{ participantText(t) }}</span>
            </span>
            <span v-if="unreadOf(t) > 0" class="trow__badge">{{ unreadOf(t) > 99 ? '99+' : unreadOf(t) }}</span>
          </button>
          <button
            class="trow__del"
            :disabled="Boolean(hidingThreadId)"
            @click="deleteThread(t)"
            :aria-label="hidingThreadId === t.id ? 'このチャットを非表示にしています' : 'このチャットを自分の一覧から非表示'"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></svg>
          </button>
        </div>

        <div v-if="threads.length === 0" class="pchats__empty">この相手との相談はまだありません</div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();

const myUid = auth.currentUser?.uid || '';
const otherName = ref('');
const threads = ref([]);
const loading = ref(true);
const loadError = ref('');
const actionError = ref('');
const hidingThreadId = ref('');
let subscriptionVersion = 0;
let unsub = null;

const unreadOf = (t) => (t.unread && t.unread[myUid]) || 0;
const participantText = (t) => {
  const count = (t.participants || []).length;
  return count > 2 ? `参加者 ${count}人` : `相手：${otherName.value || '相手'}`;
};
const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()}`;
};

const open = (t) => {
  router.push({ name: 'Thread', params: { id: t.id }, query: {
    label: t.subjectLabel || '取引の件', other: route.params.uid, otherName: otherName.value,
  }});
};
// チャットを削除（自分の一覧から非表示。新しいメッセージが来たら再表示される）
const deleteThread = async (t) => {
  if (hidingThreadId.value) return;
  actionError.value = '';
  hidingThreadId.value = t.id;
  try { await updateDoc(doc(db, 'threads', t.id), { hiddenBy: arrayUnion(myUid) }); }
  catch (e) {
    console.error('チャット削除エラー:', e);
    actionError.value = 'チャットを非表示にできませんでした。通信状況を確認してください。';
  } finally {
    if (hidingThreadId.value === t.id) hidingThreadId.value = '';
  }
};

const subscribe = () => {
  const version = ++subscriptionVersion;
  const otherUidParam = route.params.uid;
  otherName.value = '';
  if (unsub) { unsub(); unsub = null; }
  loading.value = true;
  loadError.value = '';
  actionError.value = '';
  hidingThreadId.value = '';
  threads.value = [];
  if (!myUid || !otherUidParam) { loadError.value = 'ログイン状態を確認して、開き直してください。'; loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
    if (version !== subscriptionVersion) return;
    loadError.value = '';
    const list = [];
    snap.docs.forEach((d) => {
      const t = { id: d.id, ...d.data() };
      if ((t.hiddenBy || []).includes(myUid)) return; // 削除（非表示）した会話は出さない
      if ((t.participants || []).includes(otherUidParam)) {
        list.push(t);
        if (t.participantNames && t.participantNames[otherUidParam]) otherName.value = t.participantNames[otherUidParam];
      }
    });
    // 新しい順（複合インデックス不要にするためクライアント側で並べ替え）
    list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    threads.value = list;
    loading.value = false;
  }, () => {
    if (version !== subscriptionVersion) return;
    threads.value = [];
    loadError.value = 'チャットを読み込めませんでした。通信状況を確認してください。';
    loading.value = false;
  });
};
watch(() => route.params.uid, subscribe, { immediate: true, flush: 'sync' });
onUnmounted(() => { subscriptionVersion++; if (unsub) unsub(); });
</script>

<style scoped>
.pchats__body { padding: 0 0 24px; background: var(--c-surface); min-height: 100%; }
.pchats__note { margin: 0; padding: 10px var(--pad); border-bottom: 1px solid var(--c-line); color: var(--c-text-sub); background: var(--c-bg); font-size: 12px; line-height: 1.5; }
.trow { display: flex; align-items: stretch; border-bottom: 1px solid var(--c-line); background: var(--c-surface); }
.trow__open {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px;
  padding: 14px 4px 14px var(--pad); background: transparent; border: none; text-align: left; cursor: pointer;
}
.trow__open:active { background: var(--c-surface-2); }
.trow__del { flex-shrink: 0; width: 48px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--c-text-faint); cursor: pointer; }
.trow__del:active { color: var(--c-danger); transform: scale(0.9); }
.trow__del:disabled { cursor: wait; opacity: .55; }
.trow__del svg { width: 18px; height: 18px; }
.trow__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.trow__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.trow__label { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow__time { flex-shrink: 0; font-size: 12px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.trow__msg { font-size: 13px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow__people { font-size: 12px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow__badge {
  flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center;
}
.pchats__empty { text-align: center; color: var(--c-text-faint); font-size: 14px; padding: 40px 0; }
.pchats__action-error { margin: 0; padding: 10px var(--pad); border-bottom: 1px solid var(--c-line); color: var(--c-danger); background: var(--c-surface); font-size: 13px; line-height: 1.6; }
.retry-button { margin-top: 12px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--c-line); border-radius: 8px; background: var(--c-surface); color: var(--c-brand); font: inherit; cursor: pointer; }
</style>
