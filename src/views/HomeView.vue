<template>
  <div class="home-container">
    <PaymentCarousel :summary="paymentSummary" />

    <section class="ongoing-events">
      <div class="section-header">
        <h2 class="section-title">進行中のイベント</h2>
        <button class="view-all-btn" @click="$router.push('/event')">すべて見る ›</button>
      </div>

      <div class="event-list-container">
        <div v-if="loading" class="empty-message">読み込み中...</div>

        <div v-else-if="ongoingEvents.length === 0" class="empty-message">
          進行中のイベントはありません
        </div>
        
        <div v-else class="event-item" v-for="event in ongoingEvents" :key="event.id" @click="goToEventDetail(event.id)">
          <div class="event-tag">{{ event.tag }}</div>
          <div class="event-info">
            <h3 class="event-name">{{ event.name }}</h3>
            <div class="member-icons">
              <template v-for="(photo, index) in (event.participantsPhotos || []).slice(0, 4)" :key="index">
                <img 
                  v-if="photo.startsWith('http')" 
                  :src="photo" 
                  class="circle" 
                  :style="{ zIndex: 5 - index, objectFit: 'cover' }"
                />
                <div 
                  v-else 
                  class="circle" 
                  :style="{ backgroundColor: photo, zIndex: 5 - index }"
                ></div>
              </template>

              <div v-if="(event.participants || []).length > 4" class="circle-more">
                +{{ (event.participants || []).length - 4 }}
              </div>
            </div>
          </div>
          <div class="event-amount-section">
            <span class="amount-label">合計金額</span>
            <span class="amount-value">{{ event.amount }}</span>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      </Teleport>

    <button class="add-button" @click="$router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import PaymentCarousel from '@/components/PaymentCarousel.vue';
import api from '@/services/api';

const router = useRouter();
const ongoingEvents = ref([]);
const selectedEvent = ref(null);
const loading = ref(true);

const openDetail = (event) => {
  selectedEvent.value = event;
};

const paymentSummary = ref({
  receivableTotal: 0,
  receivableList: [],
  payableTotal: 0,
  payableList: []
});

// ==========================================
// 🌟 1. 名前とアイコン取得の効率化（キャッシュ拡張）
// ==========================================
const userCache = {}; // 名前だけでなく、アイコン情報もキャッシュする

const getUserInfo = async (uid) => {
  if (!uid) return { name: "不明", icon: "#cbd5e1" };
  if (userCache[uid]) return userCache[uid]; // キャッシュがあればそれを返す
  
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const userInfo = {
        name: data.name || "不明",
        // 写真URL、設定色、フォールバック色の順で取得
        icon: data.photoURL || data.photo || data.color || "#cbd5e1"
      };
      userCache[uid] = userInfo;
      return userInfo;
    }
    return { name: "不明", icon: "#cbd5e1" };
  } catch (error) {
    console.error("User info fetch error:", error);
    return { name: "不明", icon: "#cbd5e1" };
  }
};

// 🌟 旧 getUserName は、キャッシュを利用するように修正（後方互換のため）
const getUserName = async (uid) => {
  const info = await getUserInfo(uid);
  return info.name;
};

// ==========================================
// 🌟 2. イベント一覧をサーバーから取得・整形する関数
// ==========================================
const fetchEvents = async () => {
  try {
    loading.value = true;
    await api.post('/users/sync'); 
    
    const res = await api.get('/events');
    
    // Firestoreから参加者のアイコン情報を非同期で取得して合体させる
    const formattedEvents = await Promise.all(res.data.map(async (event) => {
      // 🌟 参加者のUID配列（event.participants）から、先頭4人分のアイコンを取得
      const participantUids = event.participants || [];
      const photos = await Promise.all(
        participantUids.slice(0, 4).map(async (uid) => {
          const info = await getUserInfo(uid); // キャッシュ付き取得関数を利用
          return info.icon;
        })
      );

      return {
        ...event,
        invitationCode: event.invitationCode || 'N/A',
        amount: `¥${(event.totalAmount || 0).toLocaleString()}`,
        participantsPhotos: photos // 🌟 整形したアイコン配列を追加
      };
    }));

    ongoingEvents.value = formattedEvents;

  } catch (error) {
    console.error("イベント取得に失敗:", error);
  } finally {
    loading.value = false;
  }
};

// --- 以下、既存のロジック（そのまま） ---
let unsubReceivable = null;
let unsubPayable = null;

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const myUid = user.uid;

      // 入金待ち
      const qReceivable = query(collection(db, "transactions"), where("paidToId", "==", myUid), where("status", "==", "unpaid"));
      unsubReceivable = onSnapshot(qReceivable, async (snapshot) => {
        let total = 0;
        const list = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data();
          total += data.amount || 0;
          const name = await getUserName(data.paidById); // 修正したキャッシュ関数が走る
          return { id: d.id, name, itemName: data.itemName, amount: data.amount };
        }));
        paymentSummary.value.receivableTotal = total;
        paymentSummary.value.receivableList = list;
      });

      // 未払い
      const qPayable = query(collection(db, "transactions"), where("paidById", "==", myUid), where("status", "==", "unpaid"));
      unsubPayable = onSnapshot(qPayable, async (snapshot) => {
        let total = 0;
        const list = await Promise.all(snapshot.docs.map(async (d) => {
          const data = d.data();
          total += data.amount || 0;
          const name = await getUserName(data.paidToId); // 🌟 相手（受け取る人）の名前を取得
          return { id: d.id, name: name, itemName: data.itemName, amount: data.amount };
        }));
        paymentSummary.value.payableTotal = total;
        paymentSummary.value.payableList = list;
      });
    }
  });

  fetchEvents(); // 🌟 起動時に実行
});

onUnmounted(() => {
  if (unsubReceivable) unsubReceivable();
  if (unsubPayable) unsubPayable();
});

const copyCode = (code) => {
  if (!code) return alert('コードがありません');
  navigator.clipboard.writeText(code);
  alert('コピーしました！');
};

const deleteEvent = async (id) => {
  if (!confirm('このイベントを終了して削除しますか？')) return;
  try {
    ongoingEvents.value = ongoingEvents.value.filter(e => e.id !== id);
    selectedEvent.value = null;
  } catch (error) {
    alert("削除に失敗しました");
  }
};

const goToEventDetail = (id) => {
  selectedEvent.value = null;
  router.push(`/event/${id}`);
};
</script>

<style scoped>
/* --- 既存のスタイル --- */
.home-container { position: relative; padding-bottom: 100px; background-color: #f8fafc; min-height: 100vh; }
.ongoing-events { padding: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.section-title { font-size: 18px; font-weight: bold; color: #1e293b; margin: 0; }
.view-all-btn { background: none; border: none; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer; }
.event-list-container { display: flex; flex-direction: column; gap: 12px; }
.empty-message { text-align: center; color: #94a3b8; padding: 40px 0; font-size: 14px; font-weight: bold; background: white; border-radius: 16px; border: 2px dashed #e2e8f0; }
.event-item { background-color: white; border-radius: 16px; padding: 16px; display: flex; align-items: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s; }
.event-item:active { transform: scale(0.98); background-color: #f8fafc; }
.event-tag { background-color: #3b82f6; color: white; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 12px; margin-right: 15px; }
.event-info { flex: 1; }
.event-name { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0 0 8px 0; }
.member-icons { display: flex; align-items: center; }
.circle, .circle-more { width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; margin-left: -10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.circle:first-child { margin-left: 0; }
.circle-more { background-color: #e2e8f0; color: #64748b; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 0; margin-left: -10px; }
.event-amount-section { display: flex; flex-direction: column; align-items: flex-end; }
.amount-label { font-size: 10px; color: #64748b; font-weight: bold; }
.amount-value { font-size: 16px; font-weight: 900; color: #1e293b; }

/* 🌟 プラスボタン（＋）のスタイルを元のデザインに修正 */
.add-button {
  position: fixed;
  right: 20px;
  bottom: 100px; /* ナビゲーションバーがある場合はこの高さでOK */
  width: 60px;
  height: 60px;
  background-color: #2169a3; /* 元の青色 */
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 36px;
  display: flex;         /* 中央寄せ用 */
  align-items: center;     /* 垂直中央 */
  justify-content: center;  /* 水平中央 */
  box-shadow: 0 4px 10px rgba(33,105,163,0.3);
  z-index: 999;          /* 他の要素より上に表示 */
  cursor: pointer;
  padding: 0;
  line-height: 1;        /* 文字位置の微調整 */
}

.add-button:active {
  transform: scale(0.95); /* 押した時のリアクション */
}

/* 💻 PC版での調整 */
@media (min-width: 1024px) {
  .home-container { padding-bottom: 40px; }
  
  /* 🌟 もしPC版でもプラスボタンを出したいなら、ここを `display: flex;` に変えてください */
  /* 今はPC版ではサイドバー等から作成する想定で非表示になっています */
  .add-button {
    display: none; 
  }
}
</style>