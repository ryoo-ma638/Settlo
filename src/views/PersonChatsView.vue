<template>
  <div class="pchats">
    <PageHeader :title="otherName || 'チャット'" fallback="/chats" />

    <main class="pchats__body">
      <div v-if="loading" class="pchats__empty">読み込み中…</div>
      <template v-else>
        <div v-for="t in threads" :key="t.id" class="trow">
          <button class="trow__open" @click="open(t)">
            <span class="trow__main">
              <span class="trow__top">
                <span class="trow__label">{{ t.subjectLabel || '取引の件' }}</span>
                <span class="trow__time">{{ fmtTime(t.updatedAt) }}</span>
              </span>
              <span class="trow__msg">{{ t.lastMessage || 'やりとりを開く' }}</span>
            </span>
            <span v-if="unreadOf(t) > 0" class="trow__badge">{{ unreadOf(t) > 99 ? '99+' : unreadOf(t) }}</span>
          </button>
          <button class="trow__del" @click="deleteThread(t)" aria-label="このチャットを削除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></svg>
          </button>
        </div>

        <div v-if="threads.length === 0" class="pchats__empty">この相手とのチャットはまだありません</div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import PageHeader from '../components/PageHeader.vue';

const route = useRoute();
const router = useRouter();
const otherUidParam = route.params.uid;
const myUid = auth.currentUser?.uid || '';
const otherName = ref('');
const threads = ref([]);
const loading = ref(true);
let unsub = null;

const unreadOf = (t) => (t.unread && t.unread[myUid]) || 0;
const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getMonth() + 1}/${d.getDate()}`;
};

const open = (t) => {
  router.push({ name: 'Thread', params: { id: t.id }, query: {
    label: t.subjectLabel || '取引の件', other: otherUidParam, otherName: otherName.value,
  }});
};
// チャットを削除（自分の一覧から非表示。新しいメッセージが来たら再表示される）
const deleteThread = async (t) => {
  try { await updateDoc(doc(db, 'threads', t.id), { hiddenBy: arrayUnion(myUid) }); }
  catch (e) { console.error('チャット削除エラー:', e); }
};

onMounted(() => {
  if (!myUid) { loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
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
  }, (e) => { console.error('チャット（案件）の取得に失敗:', e); loading.value = false; });
});
onUnmounted(() => { if (unsub) unsub(); });
</script>

<style scoped>
.pchats__body { padding: 0 0 24px; background: var(--c-surface); min-height: 100%; }
.trow { display: flex; align-items: stretch; border-bottom: 1px solid var(--c-line); background: var(--c-surface); }
.trow__open {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px;
  padding: 14px 4px 14px var(--pad); background: transparent; border: none; text-align: left; cursor: pointer;
}
.trow__open:active { background: var(--c-surface-2); }
.trow__del { flex-shrink: 0; width: 48px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--c-text-faint); cursor: pointer; }
.trow__del:active { color: var(--c-danger); transform: scale(0.9); }
.trow__del svg { width: 18px; height: 18px; }
.trow__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.trow__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.trow__label { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow__time { flex-shrink: 0; font-size: 11px; color: var(--c-text-faint); font-weight: var(--fw-medium); }
.trow__msg { font-size: 13px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trow__badge {
  flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center;
}
.pchats__empty { text-align: center; color: var(--c-text-faint); font-size: 14px; padding: 40px 0; }
</style>
