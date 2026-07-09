<template>
  <div class="pchats">
    <PageHeader :title="otherName || 'チャット'" fallback="/chats" />

    <main class="pchats__body">
      <div v-if="loading" class="pchats__empty">読み込み中…</div>
      <template v-else>
        <button
          v-for="t in threads"
          :key="t.id"
          class="trow"
          @click="open(t)"
        >
          <span class="trow__main">
            <span class="trow__top">
              <span class="trow__label">{{ t.subjectLabel || '取引の件' }}</span>
              <span class="trow__time">{{ fmtTime(t.updatedAt) }}</span>
            </span>
            <span class="trow__msg">{{ t.lastMessage || 'やりとりを開く' }}</span>
          </span>
          <span v-if="unreadOf(t) > 0" class="trow__badge">{{ unreadOf(t) > 99 ? '99+' : unreadOf(t) }}</span>
        </button>

        <div v-if="threads.length === 0" class="pchats__empty">この相手とのチャットはまだありません</div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

onMounted(() => {
  if (!myUid) { loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
    const list = [];
    snap.docs.forEach((d) => {
      const t = { id: d.id, ...d.data() };
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
.pchats__body { padding: 6px 0 24px; }
.trow {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 14px var(--pad); background: transparent; border: none; border-bottom: 1px solid var(--c-line);
  text-align: left; cursor: pointer;
}
.trow:active { background: var(--c-surface-2); }
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
