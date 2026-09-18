<template>
  <div class="events">
    <header class="screen-head">
      <h1 class="screen-head__title">{{ pickPayment ? '支払いを追加するイベント' : 'イベント' }}</h1>
      <button v-if="!pickPayment" class="screen-head__action" data-tour="event-check" @click="$router.push('/payment')">精算を確認</button>
    </header>

    <!-- 作成は下の＋に集約し、招待コードでの参加だけを残す -->
    <div v-if="!pickPayment" class="events__actions">
      <button class="ev-action" @click="goJoin">コードで参加</button>
    </div>

    <div v-if="!pickPayment" class="events__filters">
      <div class="seg" role="group" aria-label="イベントの状態">
        <button type="button" class="seg__item" :class="{ 'is-active': !showEnded }" :aria-pressed="!showEnded" @click="showEnded = false">進行中</button>
        <button type="button" class="seg__item" :class="{ 'is-active': showEnded }" :aria-pressed="showEnded" @click="showEnded = true">終了済み</button>
      </div>
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
          v-for="(event, index) in visibleEvents"
          :key="event.id"
          :data-tour="index === 0 ? 'event-card' : null"
          role="button" tabindex="0"
          @click="openEvent(event.id)"
          @keydown.enter="openEvent(event.id)"
          @keydown.space.prevent="openEvent(event.id)"
        >
          <div class="evcard__top">
            <span class="tag tag--icon">
              <GenreIcon :type="event.tag" class="tag__icon" />{{ event.tag }}
            </span>
            <span v-if="isEndedForMe(event)" class="ended-tag">終了済み</span>
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
              <div v-if="(event.participants || []).length > 4" class="avatar avatar--more">
                +{{ (event.participants || []).length - 4 }}
              </div>
            </div>

            <div class="evcard__amount">
              <span class="evcard__amount-label">合計金額</span>
              <span class="evcard__amount-value tnum">¥{{ (event.totalAmount || 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <div v-if="visibleEvents.length === 0 && pendingInvites.length === 0" class="empty-box">
          <p class="empty-box__text">{{ !pickPayment && showEnded ? '終了済みのイベントはありません' : '進行中のイベントはありません' }}</p>
          <div v-if="pickPayment || !showEnded" class="empty-actions">
            <button class="btn-outline" @click="goJoin">コードで参加する</button>
          </div>
        </div>

        <!-- 一覧から隠したイベント。退出とは違い参加者のままなので、いつでも戻せるようにする。 -->
        <div v-if="hiddenEvents.length" class="hidden-block">
          <button class="hidden-toggle" type="button" :aria-expanded="showHidden" @click="showHidden = !showHidden">
            <span>非表示にしたイベント（{{ hiddenEvents.length }}件）</span>
            <span class="hidden-chevron" :class="{ open: showHidden }" aria-hidden="true">⌄</span>
          </button>
          <p v-if="showHidden" class="hidden-note">一覧から消しているだけで、参加者のままです。戻すといつでも開けます。</p>
          <div v-if="showHidden" class="hidden-list">
            <div v-for="event in hiddenEvents" :key="event.id" class="hidden-row">
              <span class="hidden-row__name">{{ event.name || 'イベント' }}</span>
              <button class="hidden-row__btn" :disabled="restoringId === event.id" @click="unhideEvent(event)">
                {{ restoringId === event.id ? '戻しています…' : '一覧に戻す' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayRemove } from 'firebase/firestore';
import { splitHiddenEvents } from '@/lib/eventMembership';
import { eventEndState } from '@/lib/eventEnd';
import GenreIcon from '@/components/GenreIcon.vue';
import InviteCard from '@/components/InviteCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
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
const goJoin = () => router.push('/make-event?join=1');


const events = ref([]);
const showEnded = ref(false);
// 取得処理の中にも同名の myUid があるので、別の名前にしておく
const viewerUid = ref(auth.currentUser?.uid || '');
// 隠したイベントは一覧に出さないが、下の「非表示にしたイベント」から戻せる
const eventSplit = computed(() => splitHiddenEvents(events.value, viewerUid.value));
const hiddenEvents = computed(() => (pickPayment.value ? [] : eventSplit.value.hidden));
const showHidden = ref(false);
const restoringId = ref('');
// 終了は人ごと。自分が終えていないイベントは、他の人が終えても一覧に残る。
const isEndedForMe = (event) => eventEndState(event, viewerUid.value).endedForMe;
const visibleEvents = computed(() => eventSplit.value.visible
  .filter(event => (pickPayment.value || !showEnded.value ? !isEndedForMe(event) : isEndedForMe(event))));
// 🌟 お試しの案内（?open=settlement）から来たときは、
//    進行中のイベントを1件そのまま開いて、まとめて精算のところまで送る。
//    一覧で止まると「押したのに何も起きない」ように見えるため。
const openFirstForSettlement = () => {
  if (route.query.open !== 'settlement') return;
  const first = visibleEvents.value[0];
  if (!first) return;
  router.replace(`/event/${first.id}?focus=settlement`);
};
watch(visibleEvents, openFirstForSettlement);

// 隠したイベントを一覧へ戻す。参加者のままなので、いつでも戻せるようにしておく。
const unhideEvent = async (event) => {
  const uid = viewerUid.value;
  if (!uid || restoringId.value) return;
  restoringId.value = event.id;
  try {
    await updateDoc(doc(db, 'events', event.id), { hiddenBy: arrayRemove(uid) });
    events.value = events.value.map(e => (e.id === event.id
      ? { ...e, hiddenBy: (e.hiddenBy || []).filter(id => id !== uid) }
      : e));
  } catch (error) {
    console.error('イベントを一覧へ戻せませんでした:', error);
  } finally {
    restoringId.value = '';
  }
};
const loading = ref(true);

// 届いている招待（未読の event_invite）
const invites = ref([]);
const handledInviteIds = ref([]); // 参加/辞退した直後に消すための控え
const pendingInvites = computed(() => {
  if (pickPayment.value || showEnded.value) return []; // 支払い先を選ぶ画面では出さない
  const joined = new Set(events.value.map(e => e.id));
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

    // 隠したイベントもここでは捨てない。捨てると戻す場所が無くなる。
    // 一覧に出すかどうかは splitHiddenEvents で分ける。
    const rawEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const formattedEvents = await Promise.all(rawEvents.map(async (event) => {
      const formattedDate = formatDate(event.createdAt) || formatDate(new Date());

      const uids = event.participants || [];
      const members = await Promise.all(uids.slice(0, 4).map(uid => getUserInfo(uid)));

      return {
        ...event,
        createdAtDate: formattedDate,
        members
      };
    }));

    viewerUid.value = myUid;
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
/* 一覧から隠したイベント */
.hidden-block { margin: 18px 2px 4px; padding-top: 10px; border-top: 1px solid var(--c-line); }
.hidden-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 8px 2px; border: 0; background: none; cursor: pointer; font-size: 12.5px; color: var(--c-text-sub); }
.hidden-chevron { transition: transform 0.2s ease; }
.hidden-chevron.open { transform: rotate(180deg); }
.hidden-note { margin: 0 2px 8px; font-size: 11.5px; line-height: 1.6; color: var(--c-text-sub); }
.hidden-list { display: flex; flex-direction: column; gap: 8px; padding-bottom: 6px; }
.hidden-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-surface); }
.hidden-row__name { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hidden-row__btn { flex-shrink: 0; padding: 7px 12px; border: 1px solid var(--c-line); border-radius: var(--r-pill, 999px); background: #fff; font-size: 12px; cursor: pointer; }
.hidden-row__btn:disabled { opacity: 0.5; cursor: default; }

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
.events__list {
  padding: 16px var(--pad) 24px; /* ← 上部のパディングを 4px から 16px などに増やす */
  display: flex;
  flex-direction: column;
  gap: 12px; /* カード同士の間隔も少し広げたい場合は調整してください */
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
.events__filters { padding: 12px var(--pad) 8px; }
.evcard:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 2px; }
.evcard__name { overflow-wrap: anywhere; }
</style>
