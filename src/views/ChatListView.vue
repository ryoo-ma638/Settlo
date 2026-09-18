<template>
  <div class="chats">
    <PageHeader title="相談" fallback="/" />

    <p class="chats__intro">イベントや立て替えについて、最近の相談を新しい順に表示します。相談を押すと内容を確認できます。</p>

    <main class="chats__body">
      <div v-if="loading" class="chats__empty">読み込み中…</div>
      <div v-else-if="loadError" class="chats__empty" role="alert">
        <p>{{ loadError }}</p><button class="retry-button" @click="subscribe">もう一度読み込む</button>
      </div>
      <template v-else>
        <button
          v-for="m in visibleMatters"
          :key="m.threadId"
          class="prow"
          @click="$router.push(`/thread/${m.threadId}`)"
        >
            <span class="prow__avatar" :class="{ 'is-group': m.isGroup }" :style="{ background: avatarColor(m.title) }">
              <svg v-if="m.isGroup" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.1"/></svg>
              <template v-else>{{ avatarInitial(m.title) }}</template>
            </span>
            <span class="prow__main">
              <span class="prow__top">
                <span class="prow__name">{{ m.title }}</span>
                <span class="prow__time">{{ fmtTime(m.lastAt) }}</span>
              </span>
              <span v-if="m.subject" class="prow__subject">{{ m.subject }}</span>
              <span class="prow__people">{{ m.isGroup ? `参加者 ${m.participantCount}人` : `相手：${m.otherNames}` }}</span>
              <span class="prow__msg">{{ m.lastMessage || 'やりとりを開く' }}</span>
            </span>
            <span v-if="m.unread > 0" class="prow__badge">{{ m.unread > 99 ? '99+' : m.unread }}</span>
        </button>

        <button v-if="hasMore" class="chats__more" @click="showMore">以前の相談を表示</button>

        <div v-if="visibleMatters.length === 0" class="chats__empty">
          <span class="chats__empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z" /></svg>
          </span>
          <p class="chats__empty-title">まだ相談はありません</p>
          <p class="chats__empty-desc">イベントや立て替えの相談がここに表示されます。</p>
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
import { avatarColor, avatarInitial } from '@/lib/avatar';

const myUid = auth.currentUser?.uid || '';
const matters = ref([]);   // 表示対象のスレッド（件）一覧
const DISPLAY_STEP = 30;
const visibleCount = ref(DISPLAY_STEP);
const loading = ref(true);
const loadError = ref('');
let subscriptionVersion = 0;
let unsub = null;

const fmtTime = (ts) => {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : formatDate(d);
};

const sortedMatters = computed(() => [...matters.value]
  .sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0)));
const visibleMatters = computed(() => sortedMatters.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleMatters.value.length < sortedMatters.value.length);
const showMore = () => { visibleCount.value += DISPLAY_STEP; };

const subscribe = () => {
  const version = ++subscriptionVersion;
  if (unsub) { unsub(); unsub = null; }
  loading.value = true;
  loadError.value = '';
  matters.value = [];
  visibleCount.value = DISPLAY_STEP;
  if (!myUid) { loadError.value = 'ログイン状態を確認して、開き直してください。'; loading.value = false; return; }
  const q = query(collection(db, 'threads'), where('participants', 'array-contains', myUid));
  unsub = onSnapshot(q, (snap) => {
    if (version !== subscriptionVersion) return;
    loadError.value = '';
    const out = [];
    snap.docs.forEach((docSnap) => {
      const t = docSnap.data();
      if ((t.hiddenBy || []).includes(myUid)) return; // 片付けた（非表示）件は出さない
      const others = (t.participants || [])
        .filter((u) => u !== myUid)
        .map((u) => ({ uid: u, name: (t.participantNames && t.participantNames[u]) || '相手' }));
      const isGroup = (t.participants || []).length > 2;
      // 相談の起点を先に示す。イベント外の1対1だけ相手名を使う。
      const title = t.eventName || (isGroup ? (t.itemName || 'みんなの精算') : (others[0]?.name || '相手'));
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
        participantCount: (t.participants || []).length,
        otherNames: others.map((o) => o.name).join('・') || '相手',
      });
    });
    matters.value = out;
    loading.value = false;
  }, () => {
    if (version !== subscriptionVersion) return;
    matters.value = [];
    loadError.value = 'チャットを読み込めませんでした。通信状況を確認してください。';
    loading.value = false;
  });
};
onMounted(subscribe);
onUnmounted(() => { subscriptionVersion++; if (unsub) unsub(); });
</script>

<style scoped>
.chats__intro { margin: 0; padding: 10px var(--pad); background: var(--c-surface); border-bottom: 1px solid var(--c-line); color: var(--c-text-sub); font-size: 12px; line-height: 1.5; }
/* 面の白は行（.prow）側が持つ。ここで白を敷くと空状態や短い一覧で
   途中から背景が切り替わり、画面中央に境界線が出てしまう */
.chats__body { padding: 0 0 24px; min-height: 100%; }
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
.prow__time { flex-shrink: 0; font-size: 12px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.prow__subject { font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__people { font-size: 12px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__msg { font-size: 13px; color: var(--c-text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prow__badge {
  flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 11px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center;
}
.chats__more { display: block; min-height: 44px; margin: 14px auto 0; padding: 8px 18px; border: 1px solid var(--c-line-bold); border-radius: 10px; background: var(--c-surface); color: var(--c-brand); font: inherit; font-weight: var(--fw-bold); cursor: pointer; }

.chats__empty { text-align: center; padding: 60px 24px; color: var(--c-text-faint); }
.chats__empty-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 50%; background: var(--c-surface-2); color: var(--c-text-faint); margin-bottom: 14px;
}
.chats__empty-icon svg { width: 30px; height: 30px; }
.chats__empty-title { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-text); margin: 0 0 4px; }
.chats__empty-desc { font-size: 13px; font-weight: var(--fw-medium); margin: 0; }
.retry-button { margin-top: 12px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--c-line); border-radius: 8px; background: var(--c-surface); color: var(--c-brand); font: inherit; cursor: pointer; }
</style>
