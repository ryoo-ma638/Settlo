<template>
  <div class="notification-wrapper" :class="{ 'static-mode': isStatic }">
    <button v-if="!isStatic" class="icon-btn" @click="showModal = true" aria-label="お知らせ">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span v-if="totalNotifs > 0" class="notification-dot"></span>
    </button>

    <Teleport to="body" v-if="!isStatic">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-window">
          <h2 class="modal-title">お知らせ</h2>
          <div class="notification-list">

            <div v-for="req in paymentReqs" :key="req.id" class="notif-item yellow">
              <span class="dot"></span>
              <div class="notif-body">
                <p>{{ req.fromUserName }}さんから支払いの承認リクエストが届いています</p>
                <button class="mini-accept-btn" @click="goToPaymentDetail(req)">詳細を確認する</button>
              </div>
            </div>

            <div v-for="req in friendReqs" :key="req.id" :class="['notif-item', req.status === 'accepted' ? 'blue' : 'pink']">
              <span class="dot"></span>
              <div class="notif-body">
                <template v-if="req.status === 'pending'">
                  <p>{{ req.formName }}さんから友達申請が届いています</p>
                  <button class="mini-accept-btn" @click="acceptRequest(req)">承認する</button>
                </template>
                <template v-else-if="req.status === 'accepted'">
                  <p>{{ req.formName }}さんとフレンドになりました！</p>
                  <button class="mini-accept-btn" @click="deleteNotification(req.id)">確認</button>
                </template>
              </div>
            </div>

            <div v-if="totalNotifs === 0" class="empty-msg">新しいお知らせはありません</div>
          </div>
          <button class="close-modal-btn" @click="showModal = false">閉じる</button>
        </div>
      </div>
    </Teleport>

    <div v-else class="static-notification-panel">
      <h2 class="sidebar-title">お知らせ</h2>
      <div class="notification-list">

        <div v-for="req in paymentReqs" :key="req.id" class="notif-item yellow">
          <span class="dot"></span>
          <div class="notif-body">
            <p>{{ req.fromUserName }}さんから支払いの承認リクエストが届いています</p>
            <button class="mini-accept-btn" @click="goToPaymentDetail(req)">詳細を確認する</button>
          </div>
        </div>

        <div v-for="req in friendReqs" :key="req.id" :class="['notif-item', req.status === 'accepted' ? 'blue' : 'pink']">
          <span class="dot"></span>
          <div class="notif-body">
            <template v-if="req.status === 'pending'">
              <p>{{ req.formName }}さんから友達申請が届いています</p>
              <button class="mini-accept-btn" @click="acceptRequest(req)">承認する</button>
            </template>
            <template v-else-if="req.status === 'accepted'">
              <p>{{ req.formName }}さんとフレンドになりました！</p>
              <button class="mini-accept-btn" @click="deleteNotification(req.id)">確認</button>
            </template>
          </div>
        </div>

        <div v-if="totalNotifs === 0" class="empty-msg">新しいお知らせはありません</div>

      </div>
    </div>
  </div>

  <BaseModal 
    :show="modalState.show"
    type="success"
    :title="modalState.title"
    :message="modalState.message"
    @confirm="modalState.show = false"
    @close="modalState.show = false"
  />
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'; 
import { useRouter } from 'vue-router'; // 🌟 ルーター追加
import BaseModal from './BaseModal.vue'; 
import { db, auth } from '@/firebase';
import { 
  collection, query, where, onSnapshot, 
  doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';

const router = useRouter(); // 🌟 画面遷移用
const friendReqs = ref([]);
const paymentReqs = ref([]); // 🌟 支払いリクエスト用の配列

// お知らせの合計件数
const totalNotifs = computed(() => friendReqs.value.length + paymentReqs.value.length);

onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      friendReqs.value = [];
      paymentReqs.value = [];
      return;
    }

    // 1. フレンド申請の取得
    const qFriend = query(
      collection(db, "friendRequests"),
      where("toId", "==", user.uid),
      where("status", "in", ["pending", "accepted"])
    );
    onSnapshot(qFriend, (snapshot) => {
      friendReqs.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    // 🌟 2. 支払いの承認リクエストの取得
    const qPayment = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      where("isRead", "==", false)
    );
    onSnapshot(qPayment, (snapshot) => {
      paymentReqs.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
  });
});

// 🌟 承認リクエストをタップした時の処理
const goToPaymentDetail = async (req) => {
  try {
    // 1. 通知を既読にしてリストから消す
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    
    // 2. スマホ版ならモーダルを閉じる
    showModal.value = false;

    // 3. お支払い詳細画面へ移動する（受け取る側なので "waiting-" をつける）
    router.push(`/payment-detail/waiting-${req.transactionId}`);
  } catch (error) {
    console.error("詳細画面への移動に失敗:", error);
  }
};

// --- 既存のフレンド申請の処理 ---
const deleteNotification = async (notifId) => {
  try { await deleteDoc(doc(db, "friendRequests", notifId)); } 
  catch (error) { console.error("通知の削除に失敗しました:", error); }
};

const modalState = reactive({ show: false, type: 'success', title: '', message: '' });

const acceptRequest = async (request) => {
  if (!request.id || !request.formId) return;
  const myUid = auth.currentUser.uid;
  const friendUid = request.formId;

  try {
    await setDoc(doc(db, "users", myUid, "friends", friendUid), {
      uid: friendUid, name: request.formName || "名前なし", photo: request.formPhoto || "", 
      isFriend: true, addedAt: serverTimestamp(), tradeCount: 0, isTrading: false
    });

    const myDoc = await getDoc(doc(db, "users", myUid));
    let myName = "名前なし", myPhoto = ""; 
    if (myDoc.exists()) {
      const myData = myDoc.data(); 
      myName = myData.name || "名前なし";
      myPhoto = myData.photo || myData.photoURL || ""; 
    }

    await setDoc(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid, name: myName, photo: myPhoto, isFriend: true, addedAt: serverTimestamp(), tradeCount: 0, isTrading: false
    });

    await addDoc(collection(db, "friendRequests"), {
      toId: friendUid, formId: myUid, formName: myName, formPhoto: myPhoto, status: "accepted", createdAt: serverTimestamp()
    });

    await deleteDoc(doc(db, "friendRequests", request.id));
    alert(`${request.formName}さんとフレンドになりました！`);
  } catch (error) {
    console.error("承認エラー:", error);
  }
};

const props = defineProps({ isStatic: { type: Boolean, default: false } });
const showModal = ref(false);
const open = () => { showModal.value = true; };
defineExpose({ open });
</script>

<style scoped>
/* --- NotificationIcon.vue の <style scoped> の中 --- */

/* 🌟 修正：大枠の背景色を白にし、画面の高さにピッタリ固定する */
.notification-wrapper.static-mode {
  height: 100vh;
  background-color: #ffffff; /* 背景色を白にする */
}

/* PC右サイドバー用の直接表示スタイル */
.static-notification-panel {
  /* 下の余白(padding)を 0 にして、謎の空間を完全に消し去る！ */
  padding: 20px 20px 0 20px;
  background-color: #ffffff;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.sidebar-title {
  font-size: 20px; font-weight: bold; margin-bottom: 20px;
  color: #1a1a1a; text-align: left;
  flex-shrink: 0; 
}

/* アイコンボタンの設定 */
.icon-btn {
  background: none; border: none; padding: 5px; cursor: pointer;
  color: #334155; position: relative; display: flex;
}
.notification-dot {
  position: absolute; top: 2px; right: 4px;
  width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; border: 2px solid white;
}

/* 画面全体の背景 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

/* 白い窓本体 */
.modal-window {
  width: 100%;
  max-width: 350px;
  max-height: 80vh; 
  background-color: #eef7ff;
  border-radius: 30px;
  padding: 25px;
  display: flex;
  flex-direction: column; 
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
}

.modal-title {
  font-size: 26px; font-weight: bold; margin-bottom: 20px;
  color: #1a1a1a !important; text-align: center;
  flex-shrink: 0; 
}

/* 🌟 お知らせリスト領域（スクロールの設定） */
.notification-list {
  flex: 1; 
  overflow-y: auto; 
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* 🌟 修正：リストの中の最後にだけ余白を持たせる（一番下までスクロールした時だけ見える） */
  padding: 5px 2px 20px 2px;
  
  scrollbar-width: none; /* スクロールバーを隠す */
  -webkit-overflow-scrolling: touch; 
}
.notification-list::-webkit-scrollbar {
  display: none;
}

/* 各お知らせのカード */
.notif-item {
  position: relative; padding: 15px; border-radius: 22px;
  font-size: 14px; font-weight: bold; line-height: 1.4;
  color: #1a1a1a !important; text-align: left;
  flex-shrink: 0; 
}

/* お知らせの中身を整える */
.notif-body {
  display: flex;  flex-direction: column;  gap: 8px;  width: 100%;
}

/* 承認ボタンのデザイン */
.mini-accept-btn {
  align-self: flex-end; /* 右寄せ */  background-color: #ffffff;  border: 1px solid #fca5a5; /* 薄いピンクの枠線 */
  color: #ef4444;  padding: 4px 12px;  border-radius: 12px;  font-size: 12px;
  font-weight: bold;  cursor: pointer;  transition: all 0.2s;
}

.mini-accept-btn:hover {
  background-color: #ef4444;  color: #fff;
}

/* 空の状態のメッセージ */
.empty-msg {
  text-align: center;  color: #94a3b8;  font-size: 14px;  margin-top: 20px;
}

.dot {
  position: absolute; left: -6px; top: 14px;
  width: 14px; height: 14px; background-color: #40ffff;
  border-radius: 50%; border: 2px solid #eef7ff;
}

/* 配色パターン */
.pink { background-color: #fce4e4 !important; }
.blue { background-color: #8bb4ff !important; }
.red { background-color: #ff6b6b !important; color: #ffffff !important; }
.yellow { background-color: #fff48f !important; }

/* 閉じるボタン */
.close-modal-btn {
  margin-top: 20px; padding: 12px 40px; background-color: white;
  color: #3b82f6; border: none; border-radius: 25px;
  font-weight: bold; font-size: 16px; cursor: pointer;
  flex-shrink: 0; 
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.close-modal-btn:active { transform: scale(0.95); }
</style>