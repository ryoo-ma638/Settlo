<template>
  <div class="chats">
    <PageHeader title="チャット" fallback="/" />

    <div class="chats__seg-wrap">
      <div class="seg">
        <button class="seg__item" :class="{ 'is-active': mode === 'event' }" @click="mode = 'event'">イベントごと</button>
        <button class="seg__item" :class="{ 'is-active': mode === 'person' }" @click="mode = 'person'">人ごと</button>
      </div>
    </div>

    <main class="chats__body">
      <div v-if="loading" class="chats__empty">読み込み中…</div>
      <template v-else>
        <template v-for="g in groups" :key="g.key">
          <h2 class="chats__group">{{ g.title }}</h2>
          <button
            v-for="m in g.matters"
            :key="g.key + m.threadId"
            class="prow"
            @click="$router.push(`/thread/${m.threadId}`)"
          >
            <span class="prow__avatar" :class="{ 'is-group': m.isGroup }" :style="{ background: colorFor(m.threadId) }">
              <svg v-if="m.isGroup" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.1"/></svg>
              <template v-else>{{ initial(m.title) }}</template>
            </span>
            <span class="prow__main">
              <span class="prow__top">
                <span class="prow__name">{{ m.title }}</span>
                <span class="prow__time">{{ fmtTime(m.lastAt) }}</span>
              </span>
              <span v-if="m.subject" class="prow__subject">{{ m.subject }}</span>
              <span class="prow__msg">{{ m.lastMessage || 'やりとりを開く' }}</span>
            </span>
            <span v-if="m.unread > 0" class="prow__badge">{{ m.unread > 99 ? '99+' : m.unread }}</span>
          </button>
        </template>

        <div v-if="groups.length === 0" class="chats__empty">
          <span class="chats__empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z" /></svg>
          </span>
          <p class="chats__empty-title">まだチャットはありません</p>
          <p class="chats__empty-desc">立て替えを追加するか、お知らせの「返信」から会話が始まります</p>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { db, auth } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import PageHeader from '../components/PageHeader.vue';
import { formatDate } from '../lib/format';

const myUid = auth.currentUser?.uid || '';
const mode = ref('event'); // 'event' = イベントごと / 'person' = 人ごと
const matters = ref([]);   // 表示対象のスレッド（件）一覧
const loading = ref(true);
let unsub = null;

const initial = (name) => (name || '？').trim().charAt(0);
const colors = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
const colorFor = (key) => colors[[...(key || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];

const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : formatDate(d);
};

// イベントごと / 人ごと でグループ化して見出し付きで並べる
const groups = computed(() => {
  const list = [...matters.value].sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0));
  const map = new Map();
  const push = (key, title, m) => {
    if (!map.has(key)) map.set(key, { key, title, matters: [] });
    map.get(key).matters.push(m);
  };
  if (mode.value === 'event') {
    list.forEach((m) => push(m.eventId || 'none', m.eventName || 'イベント外', m));
  } else {
    // 人ごと：件に関わる相手それぞれの見出しに出す
    list.forEach((m) => {
      if (m.others.length === 0) push('none', 'その他', m);
      m.others.forEach((o) => push(o.uid, o.name, m));
    });
  }
  return [...map.values()];
});

onMounted(() => {
  if (!myUid) { loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
    const out = [];
    snap.docs.forEach((docSnap) => {
      const t = docSnap.data();
      if ((t.hiddenBy || []).includes(myUid)) return; // 片付けた（非表示）件は出さない
      const others = (t.participants || [])
        .filter((u) => u !== myUid)
        .map((u) => ({ uid: u, name: (t.participantNames && t.participantNames[u]) || '相手' }));
      const isGroup = (t.participants || []).length > 2;
      // 件のタイトル：グループはイベント/件名、1対1は相手名
      const title = isGroup
        ? (t.eventName || t.itemName || 'みんなの精算')
        : (others[0]?.name || '相手');
      out.push({
        threadId: docSnap.id,
        title,
        subject: t.subjectLabel || '',
        lastMessage: t.lastMessage || '',
        lastAt: t.updatedAt,
        unread: (t.unread && t.unread[myUid]) || 0,
        eventId: t.eventId || null,
        eventName: t.eventName || '',
        others,
        isGroup,
      });
    });
    matters.value = out;
    loading.value = false;
  }, (e) => { console.error('チャット一覧の取得に失敗:', e); loading.value = false; });
});
onUnmounted(() => { if (unsub) unsub(); });
</script>

<style scoped>
.chats__seg-wrap { padding: 10px var(--pad); background: var(--c-surface); border-bottom: 1px solid var(--c-line); }
/* 面の白は行（.prow）側が持つ。ここで白を敷くと空状態や短い一覧で
   途中から背景が切り替わり、画面中央に境界線が出てしまう */
.chats__body { padding: 0 0 24px; min-height: 100%; }
.chats__group {
  font-size: 12px; font-weight: var(--fw-black); color: var(--c-text-sub);
  padding: 14px var(--pad) 6px; background: var(--c-bg);
}
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
.prow__avatar.is-group { border-radius: 15px; }
.prow__avatar svg { width: 24px; height: 24px; }
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
