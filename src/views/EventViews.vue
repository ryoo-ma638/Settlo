<template>
  <div class="events">
    <header class="screen-head">
      <h1 class="screen-head__title">進行中のイベント</h1>
      <button class="screen-head__action" @click="$router.push('/payment')">精算を確認</button>
    </header>

    <main class="events__list">
      <div v-if="loading" class="empty-box">読み込み中…</div>

      <template v-else>
        <div
          class="evcard"
          v-for="event in events"
          :key="event.id"
          @click="$router.push(`/event/${event.id}`)"
        >
          <div class="evcard__top">
            <span class="tag tag--icon">
              <GenreIcon :type="event.tag" class="tag__icon" />{{ event.tag }}
            </span>
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

        <div v-if="events.length === 0" class="empty-box">
          進行中のイベントはありません
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db, auth } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import GenreIcon from '@/components/GenreIcon.vue';

const events = ref([]);
const loading = ref(true);

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

    const rawEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const formattedEvents = await Promise.all(rawEvents.map(async (event) => {
      const dateObj = event.createdAt?.toDate ? event.createdAt.toDate() : new Date();
      const formattedDate = `${dateObj.getFullYear()}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getDate().toString().padStart(2, '0')}`;

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

onMounted(() => {
  fetchEvents();
});
</script>

<style scoped>
.events__list {
  padding: 4px var(--pad) 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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
