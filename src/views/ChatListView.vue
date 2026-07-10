<template>
  <div class="chats">
    <PageHeader title="チャット" fallback="/" />

    <main class="chats__body">
      <div v-if="loading" class="chats__empty">読み込み中…</div>
      <template v-else>
        <button
          v-for="p in people"
          :key="p.uid"
          class="prow"
          @click="$router.push(`/chats/${p.uid}`)"
        >
          <span class="prow__avatar" :style="{ background: colorFor(p.uid) }">{{ initial(p.name) }}</span>
          <span class="prow__main">
            <span class="prow__top">
              <span class="prow__name">{{ p.name }}</span>
              <span class="prow__time">{{ fmtTime(p.lastAt) }}</span>
            </span>
            <span v-if="p.subject" class="prow__subject">{{ p.subject }}</span>
            <span class="prow__msg">{{ p.lastMessage || 'やりとりを開く' }}</span>
          </span>
          <span v-if="p.unread > 0" class="prow__badge">{{ p.unread > 99 ? '99+' : p.unread }}</span>
        </button>

        <div v-if="people.length === 0" class="chats__empty">
          <span class="chats__empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z" /></svg>
          </span>
          <p class="chats__empty-title">まだチャットはありません</p>
          <p class="chats__empty-desc">お知らせの「返信」から会話を始められます</p>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import PageHeader from '../components/PageHeader.vue';

const myUid = auth.currentUser?.uid || '';
const people = ref([]);
const loading = ref(true);
let unsub = null;

const initial = (name) => (name || '？').trim().charAt(0);
const colors = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
const colorFor = (uid) => colors[[...(uid || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];

const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getMonth() + 1}/${d.getDate()}`;
};

onMounted(() => {
  if (!myUid) { loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
    // 複合インデックス不要にするため、並べ替えはクライアント側で（新しい順）
    const docsSorted = [...snap.docs].sort((a, b) => (b.data().updatedAt?.seconds || 0) - (a.data().updatedAt?.seconds || 0));
    const byPerson = new Map();
    docsSorted.forEach((docSnap) => {
      const t = docSnap.data();
      if ((t.hiddenBy || []).includes(myUid)) return; // 削除（非表示）したチャットは出さない
      const otherUid = (t.participants || []).find((u) => u !== myUid);
      if (!otherUid) return;
      const name = (t.participantNames && t.participantNames[otherUid]) || '相手';
      const unread = (t.unread && t.unread[myUid]) || 0;
      const prev = byPerson.get(otherUid);
      if (!prev) {
        // 一覧は updatedAt 降順なので、最初に入った方が最新の件
        byPerson.set(otherUid, { uid: otherUid, name, unread, subject: t.subjectLabel || '', lastMessage: t.lastMessage || '', lastAt: t.updatedAt });
      } else {
        prev.unread += unread;
      }
    });
    people.value = [...byPerson.values()];
    loading.value = false;
  }, (e) => { console.error('チャット一覧の取得に失敗:', e); loading.value = false; });
});
onUnmounted(() => { if (unsub) unsub(); });
</script>

<style scoped>
.chats__body { padding: 0 0 24px; background: var(--c-surface); min-height: 100%; }
.prow {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 13px var(--pad); background: var(--c-surface); border: none;
  border-bottom: 1px solid var(--c-line); text-align: left; cursor: pointer;
}
.prow:active { background: var(--c-surface-2); }
.prow__avatar {
  flex-shrink: 0; width: 46px; height: 46px; border-radius: 50%;
  color: #fff; font-weight: var(--fw-black); font-size: 18px;
  display: flex; align-items: center; justify-content: center;
}
.prow__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.prow__top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.prow__name { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__time { flex-shrink: 0; font-size: 11px; color: var(--c-text-faint); font-weight: var(--fw-medium); }
.prow__subject { font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__msg { font-size: 13px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__badge {
  flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center;
}

.chats__empty { text-align: center; padding: 60px 24px; color: var(--c-text-faint); }
.chats__empty-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 50%; background: var(--c-surface-2); color: var(--c-text-faint); margin-bottom: 14px;
}
.chats__empty-icon svg { width: 30px; height: 30px; }
.chats__empty-title { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-text); margin: 0 0 4px; }
.chats__empty-desc { font-size: 13px; font-weight: var(--fw-medium); margin: 0; }
</style>
