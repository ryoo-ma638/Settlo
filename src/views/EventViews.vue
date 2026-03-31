<template>
  <div class="event-page-container">
    <header class="page-header">
      <h1 class="page-title">進行中のイベント</h1>
      <button class="check-settle-btn" @click="$router.push('/payment')">
        精算を確認する
      </button>
    </header>

    <main class="list-content">
      <div v-if="loading" class="empty-msg">読み込み中...</div>

      <template v-else>
        <div 
          class="event-card" 
          v-for="event in events" 
          :key="event.id" 
          @click="$router.push(`/event/${event.id}`)"
        >
          <div class="card-header">
            <span class="event-tag blue-tag">{{ event.tag }}</span>
            <span class="event-date">{{ event.createdAtDate }}</span>
          </div>
          <h2 class="event-name">{{ event.name }}</h2>
          
          <div class="card-footer">
            <div class="participants">
              <template v-for="(photo, index) in (event.participantsPhotos || []).slice(0, 4)" :key="index">
                <img 
                  v-if="photo.startsWith('http')" 
                  :src="photo" 
                  class="avatar" 
                  :style="{ zIndex: 5 - index }"
                />
                <div 
                  v-else 
                  class="avatar" 
                  :style="{ backgroundColor: photo, zIndex: 5 - index }"
                ></div>
              </template>

              <div v-if="event.participants.length > 4" class="avatar-more">
                +{{ event.participants.length - 4 }}
              </div>
            </div>

            <div class="event-amount-section">
              <span class="label">合計金額</span>
              <span class="amount">
                ¥{{ (event.totalAmount || 0).toLocaleString() }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="events.length === 0" class="empty-msg">
          進行中のイベントはありません
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
// EventViews.vue の上の方
import { ref, onMounted } from 'vue';
import { db, auth } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
// import api from '@/services/api'; ← これは消すかコメントアウト

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

// EventViews.vue の中にある fetchEvents をこれに上書き！
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
/* 基本スタイル */
.event-page-container { min-height: 100vh; background-color: #f0f4f8; padding-bottom: 80px; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10; }
.page-title { font-size: 20px; font-weight: bold; margin: 0; color: #1e293b; }
.check-settle-btn { background-color: #2169a3; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(33,105,163,0.3); transition: 0.2s; }
.check-settle-btn:active { transform: scale(0.95); }

.list-content { padding: 10px 20px; display: flex; flex-direction: column; gap: 15px; }
.event-card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s; }
.event-card:active { transform: scale(0.98); background-color: #f8fafc; }

.card-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
.event-tag { padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: bold; color: white; }
.blue-tag { background-color: #3b82f6; }
.event-date { font-size: 12px; color: #94a3b8; }

.event-name { font-size: 18px; font-weight: bold; margin: 0 0 20px 0; color: #1e293b; }

.card-footer { display: flex; justify-content: space-between; align-items: flex-end; }
.participants { display: flex; align-items: center; }

/* 🌟 アバターのスタイル（画像対応） */
.avatar, .avatar-more { 
  width: 30px; 
  height: 30px; 
  border-radius: 50%; 
  border: 2px solid white; 
  margin-left: -10px; 
  object-fit: cover; /* 画像が歪まないように */
}
.avatar:first-child { margin-left: 0; }
.avatar-more { background-color: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #64748b; margin-left: -10px; z-index: 0; }

.total-amount { display: flex; flex-direction: column; align-items: flex-end; }
.label { font-size: 10px; color: #64748b; }
.amount { font-size: 20px; font-weight: 900; color: #1e293b; }

.empty-msg { text-align: center; color: #94a3b8; font-weight: bold; margin-top: 40px; }
.event-amount-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end; /* 右寄せ */
}

.label {
  font-size: 10px;
  color: #64748b;
  font-weight: bold;
}

.amount {
  font-size: 20px;
  font-weight: 900;
  color: #1e293b;
}
</style>