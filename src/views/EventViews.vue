<template>
  <div class="events">
    <header class="screen-head">
      <h1 class="screen-head__title">{{ screenTitle }}</h1>
      <button v-if="!pickPayment" class="screen-head__action" data-tour="event-check" @click="$router.push('/payment')">精算を確認</button>
    </header>

    <!-- 下の＋ボタンを使わなくても、ここから作成／参加できる -->
    <div v-if="!pickPayment" class="events__actions">
      <button class="ev-action ev-action--primary" @click="goCreate">＋ イベントを作成</button>
      <button class="ev-action" @click="goJoin">コードで参加</button>
    </div>

    <!-- 終了済みは進行中と混ざらないよう、タブで切り替える -->
    <div v-if="!pickPayment" class="seg events__tabs">
      <button class="seg__item" :class="{ 'is-active': activeTab === 'ongoing' }" @click="activeTab = 'ongoing'">進行中</button>
      <button class="seg__item" :class="{ 'is-active': activeTab === 'ended' }" @click="activeTab = 'ended'">終了済み</button>
    </div>

    <main class="events__list">
      <p v-if="pickPayment" class="events__pickhint">立て替えを記録するイベントを選んでください。</p>
      <div v-if="loading" class="empty-box">読み込み中…</div>

      <template v-else>
        <!-- 届いている招待（ベルを開かなくてもここから参加できる） -->
        <InviteCard
          v-for="invite in pendingInvites"
          :key="invite.id"
          :invite="invite"
          @handled="onInviteHandled"
        />

        <div
          class="evcard"
          v-for="(event, index) in events"
          :key="event.id"
          :data-tour="index === 0 ? 'event-card' : null"
          @click="openEvent(event.id)"
        >
          <div class="evcard__top">
            <span class="tag tag--icon">
              <GenreIcon :type="event.tag" class="tag__icon" />{{ event.tag }}
            </span>
            <span v-if="event.ended" class="ended-tag">終了済み</span>
            <span class="evcard__date">{{ event.createdAtDate }}</span>
          </div>

          <h2 class="evcard__name">{{ event.name }}</h2>

          <div class="evcard__bottom">
            <div class="avatars">
              <UserAvatar
                v-for="(m, index) in (event.members || [])"
                :key="index"
                class="avatar"
                :style="{ zIndex: 5 - index }"
                :name="m.name"
                :photo="m.photo"
                :size="30"
              />
              <div v-if="event.participants.length > 4" class="avatar avatar--more">
                +{{ event.participants.length - 4 }}
              </div>
            </div>

            <div class="evcard__amount">
              <span class="evcard__amount-label">合計金額</span>
              <span class="evcard__amount-value tnum">¥{{ (event.totalAmount || 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div v-if="events.length === 0 && pendingInvites.length === 0" class="empty-box">
          <p class="empty-box__text">{{ activeTab === 'ended' ? '終了したイベントはありません' : '進行中のイベントはありません' }}</p>
          <div v-if="activeTab !== 'ended'" class="empty-actions">
            <button class="btn-brand" @click="goCreate">イベントを作成する</button>
            <button class="btn-outline" @click="goJoin">コードで参加する</button>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import GenreIcon from '@/components/GenreIcon.vue';
import InviteCard from '@/components/InviteCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { formatDate } from '@/lib/format';
import { subscribePendingInvites } from '@/lib/invite';
import { fetchLastActivityAt, sortEventsByActivity, splitEventsByEnded } from '@/lib/eventList';

const route = useRoute();
const router = useRouter();
// 🌟「お支払いを追加」からイベントを選ぶモード（?pick=payment）
const pickPayment = computed(() => route.query.pick === 'payment');
const openEvent = (id) => {
  // 支払い追加モードならイベント詳細で支払い追加モーダルを直接開く
  router.push(pickPayment.value ? `/event/${id}?addPayment=1` : `/event/${id}`);
};
const goCreate = () => router.push('/make-event');
const goJoin = () => router.push('/make-event?join=1');

// 整形済みの全イベント（進行中・終了済み両方）。タブと支払い選択はここから振り分ける。
const allEvents = ref([]);
const loading = ref(true);

// 進行中／終了済みのタブ（終了したイベントを「進行中」と混ぜないための切り替え）
const activeTab = ref('ongoing');

const splitEvents = computed(() => splitEventsByEnded(allEvents.value));
// 並び順＝最後にお支払いが追加・編集された順（新しい順）
const ongoingEvents = computed(() => sortEventsByActivity(splitEvents.value.ongoing));
const endedEvents = computed(() => sortEventsByActivity(splitEvents.value.ended));

// 画面に出す一覧：支払い追加の選択では終了済みは選べないようにする
const events = computed(() => {
  if (pickPayment.value) return ongoingEvents.value;
  return activeTab.value === 'ended' ? endedEvents.value : ongoingEvents.value;
});

const screenTitle = computed(() => {
  if (pickPayment.value) return '支払いを追加するイベント';
  return activeTab.value === 'ended' ? '終了したイベント' : '進行中のイベント';
});

// 届いている招待（未読の event_invite）
const invites = ref([]);
const handledInviteIds = ref([]); // 参加/辞退した直後に消すための控え
const pendingInvites = computed(() => {
  if (pickPayment.value || activeTab.value === 'ended') return []; // 選択画面・終了済みタブでは出さない
  const joined = new Set(allEvents.value.map(e => e.id));
  return invites.value.filter(n => !handledInviteIds.value.includes(n.id) && !joined.has(n.eventId));
});
const onInviteHandled = (id) => {
  handledInviteIds.value = [...handledInviteIds.value, id];
};

// 🌟 キャッシュ用オブジェクト（同じユーザーを何度も取得しない）
const userCache = {};

// 🌟 UIDからアイコン（写真または色）を取得する関数
// 参加者の名前と写真（写真が無い人は名前の頭文字で描く）
const getUserInfo = async (uid) => {
  if (!uid) return { name: "", photo: "" };
  if (userCache[uid]) return userCache[uid];

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const info = { name: data.name || "", photo: data.photoURL || data.photo || "" };
      userCache[uid] = info;
      return info;
    }
    return { name: "", photo: "" };
  } catch (error) {
    console.error("User info fetch error:", error);
    return { name: "", photo: "" };
  }
};

const fetchEvents = async () => {
  try {
    loading.value = true;
    const myUid = auth.currentUser?.uid;
    if (!myUid) return;

    // APIを使わず、直接Firestoreから自分のイベントを取得
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, where("participants", "array-contains", myUid));
    const snapshot = await getDocs(q);

    const rawEvents = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(event => !(event.hiddenBy || []).includes(myUid)); // 自分がゴミ箱に入れたイベントは非表示

    const formattedEvents = await Promise.all(rawEvents.map(async (event) => {
      const formattedDate = formatDate(event.createdAt) || formatDate(new Date());

      const uids = event.participants || [];
      const [members, lastActivityAt] = await Promise.all([
        Promise.all(uids.slice(0, 4).map(uid => getUserInfo(uid))),
        fetchLastActivityAt(db, event.id),
      ]);

      return {
        ...event,
        createdAtDate: formattedDate,
        members,
        lastActivityAt,
      };
    }));

    allEvents.value = formattedEvents; // 並び替え・進行中/終了済みの振り分けは computed 側で行う
  } catch (error) {
    console.error("イベント一覧の取得に失敗:", error);
  } finally {
    loading.value = false;
  }
};

let unsubInvites = null;
let unsubAuth = null;

onMounted(() => {
  fetchEvents();
  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubInvites) { unsubInvites(); unsubInvites = null; }
    if (!user) { invites.value = []; return; }
    unsubInvites = subscribePendingInvites(user.uid, (list) => { invites.value = list; });
  });
});

onUnmounted(() => {
  if (unsubInvites) unsubInvites();
  if (unsubAuth) unsubAuth();
});
</script>

<style scoped>
.events__tabs { margin: 10px var(--pad) 0; }

.events__list {
  padding: 4px var(--pad) 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.events__pickhint { font-size: 13px; color: var(--c-text-sub); margin: 4px 2px 6px; }

/* 一覧上部の作成／参加ボタン（スマホ幅でも折り返さない小さめサイズ） */
.events__actions {
  display: flex;
  gap: 8px;
  padding: 4px var(--pad) 0;
}
.ev-action {
  flex: 1;
  min-width: 0;
  padding: 10px 6px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1.5px solid var(--c-line-bold);
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: var(--fw-bold);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: transform 0.12s ease, background-color 0.2s ease;
}
.ev-action:active { transform: scale(0.98); background: var(--c-surface-2); }
.ev-action--primary {
  background: var(--c-brand);
  border-color: var(--c-brand);
  color: #fff;
}
.ev-action--primary:active { background: var(--c-brand-strong); }

/* 0件のときの導線 */
.empty-box__text { margin-bottom: 16px; }
.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 260px;
  margin: 0 auto;
}
.empty-actions .btn-brand { font-size: 15px; padding: 13px 16px; }
.empty-actions .btn-outline { font-size: 14px; padding: 12px 16px; }

.evcard {
  background: var(--c-surface);
  border-radius: var(--r-lg);
  padding: 15px 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.evcard:active { transform: scale(0.985); }

.evcard__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tag--icon { display: inline-flex; align-items: center; gap: 5px; }
.tag__icon { width: 14px; height: 14px; }
.evcard__date { font-size: 12px; color: var(--c-text-faint); font-weight: var(--fw-medium); }
.ended-tag { margin-left: auto; margin-right: 8px; padding: 2px 8px; border-radius: 999px; background: var(--c-brand-weak); color: var(--c-brand); font-size: 11px; font-weight: var(--fw-bold); }

.evcard__name {
  font-size: 17px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin-bottom: 12px;
}

.evcard__bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.avatars { display: flex; align-items: center; }
.avatar {
  width: 30px; height: 30px; border-radius: 50%;
  border: 2px solid var(--c-surface); margin-left: -10px; object-fit: cover;
  background: var(--c-line-bold);
}
.avatar:first-child { margin-left: 0; }
.avatar--more {
  background: var(--c-surface-2); color: var(--c-text-sub);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: var(--fw-bold);
}

.evcard__amount { display: flex; flex-direction: column; align-items: flex-end; }
.evcard__amount-label { font-size: 10px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.evcard__amount-value { font-size: 20px; font-weight: var(--fw-black); color: var(--c-ink); }
</style>
