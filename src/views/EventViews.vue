<template>
  <div class="events">
    <header class="screen-head">
      <h1 class="screen-head__title">{{ pickPayment ? '支払いを追加するイベント' : '進行中のイベント' }}</h1>
      <button v-if="!pickPayment" class="screen-head__action" data-tour="event-check" @click="$router.push('/payment')">精算を確認</button>
    </header>

    <!-- 下の＋ボタンを使わなくても、ここから作成／参加できる -->
    <div v-if="!pickPayment" class="events__actions">
      <button class="ev-action ev-action--primary" @click="goCreate">＋ イベントを作成</button>
      <button class="ev-action" @click="goJoin">コードで参加</button>
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
              <template v-for="(photo, index) in (event.participantsPhotos || []).slice(0, 4)" :key="index">
                <img v-if="photo.startsWith('http')" :src="photo" class="avatar" :style="{ zIndex: 5 - index }" />
                <div v-else class="avatar" :style="{ backgroundColor: photo, zIndex: 5 - index }"></div>
              </template>
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
          <p class="empty-box__text">進行中のイベントはありません</p>
          <div class="empty-actions">
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
import { formatDate } from '@/lib/format';
import { subscribePendingInvites } from '@/lib/invite';

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

const events = ref([]);
const loading = ref(true);

// 届いている招待（未読の event_invite）
const invites = ref([]);
const handledInviteIds = ref([]); // 参加/辞退した直後に消すための控え
const pendingInvites = computed(() => {
  if (pickPayment.value) return []; // 支払い先を選ぶ画面では出さない
  const joined = new Set(events.value.map(e => e.id));
  return invites.value.filter(n => !handledInviteIds.value.includes(n.id) && !joined.has(n.eventId));
});
const onInviteHandled = (id) => {
  handledInviteIds.value = [...handledInviteIds.value, id];
};

// 🌟 キャッシュ用オブジェクト（同じユーザーを何度も取得しない）
const userCache = {};

// 🌟 UIDからアイコン（写真または色）を取得する関数
const getUserIcon = async (uid) => {
  if (!uid) return "#cbd5e1";
  if (userCache[uid]) return userCache[uid];

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const icon = data.photoURL || data.photo || data.color || "#cbd5e1";
      userCache[uid] = icon;
      return icon;
    }
    return "#cbd5e1";
  } catch (error) {
    console.error("User icon fetch error:", error);
    return "#cbd5e1";
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
      const photos = await Promise.all(
        uids.slice(0, 4).map(uid => getUserIcon(uid))
      );

      return {
        ...event,
        createdAtDate: formattedDate,
        participantsPhotos: photos
      };
    }));

    events.value = formattedEvents.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
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
