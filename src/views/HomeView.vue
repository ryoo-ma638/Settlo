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
      <transition name="fade">
        <div v-if="selectedEvent" class="modal-overlay" @click.self="selectedEvent = null">
          <div class="detail-modal">
            
            <div class="modal-header">
              <span class="modal-tag">{{ selectedEvent.tag }}</span>
              <button class="close-btn" @click="selectedEvent = null">×</button>
            </div>
            
            <h2 class="modal-title">{{ selectedEvent.name }}</h2>
            
            <div class="modal-section">
              <label>メモ（目的・ルール）</label>
              <div class="modal-text">{{ selectedEvent.memo || 'メモはありません' }}</div>
            </div>

            <div class="modal-section">
              <label>招待コード</label>
              <div class="modal-code-box">
                <span class="modal-code">{{ selectedEvent.invitationCode }}</span>
                <button class="modal-copy-btn" @click="copyCode(selectedEvent.invitationCode)">コピー</button>
              </div>
            </div>

            <div class="modal-footer">
              <button class="go-detail-btn" @click="goToEventDetail(selectedEvent.id)">
                このイベントの詳細・精算へ進む
              </button>
              <button class="delete-btn" @click="deleteEvent(selectedEvent.id)">
                このイベントを終了する
              </button>
              <button class="cancel-btn" @click="selectedEvent = null">
                閉じる
              </button>
            </div>

          </div>
        </div>
      </transition>

      <BaseModal 
        :show="modalState.show"
        :type="modalState.type"
        :title="modalState.title"
        :message="modalState.message"
        :showCancel="modalState.showCancel"
        :confirmText="modalState.confirmText"
        :cancelText="modalState.cancelText"
        @confirm="handleConfirmModal"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />
    </Teleport>
      

    <button class="add-button" @click="$router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue'; 
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
import PaymentCarousel from '@/components/PaymentCarousel.vue';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 Eventブランチの統一モーダル
import api from '@/services/api'; 

const router = useRouter();
const ongoingEvents = ref([]);
const selectedEvent = ref(null);
const loading = ref(true);

const openDetail = (event) => {
  selectedEvent.value = event;
};

// 🌟 モーダル状態管理 (Eventブランチの機能)
const modalState = reactive({
  show: false, type: 'info', title: '', message: '', 
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
};
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

const paymentSummary = ref({
  receivableTotal: 0,
  receivableList: [],
  payableTotal: 0,
  payableList: []
});

// ==========================================
// 🌟 1. 名前とアイコン取得の効率化（mainブランチの機能）
// ==========================================
const userCache = {}; 

const getUserInfo = async (uid) => {
  if (!uid) return { name: "不明", icon: "#cbd5e1" };
  if (userCache[uid]) return userCache[uid]; 
  
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const userInfo = {
        name: data.name || "不明",
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

const getUserName = async (uid) => {
  const info = await getUserInfo(uid);
  return info.name;
};

// ==========================================
// 🌟 2. イベント一覧をサーバーから取得・整形する関数（mainブランチの機能）
// ==========================================
// HomeView.vue の中にある fetchEvents をこれに上書き！
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
      const uids = event.participants || [];
      const photos = await Promise.all(
        uids.slice(0, 4).map(async (uid) => {
          const info = await getUserInfo(uid); 
          return info.icon;
        })
      );

      return {
        ...event,
        invitationCode: event.invitationCode || 'N/A',
        amount: `¥${(event.totalAmount || 0).toLocaleString()}`,
        participantsPhotos: photos 
      };
    }));

    ongoingEvents.value = formattedEvents;

  } catch (error) {
    console.error("イベント取得に失敗:", error);
  } finally {
    loading.value = false;
  }
};

// --- 取引情報の監視ロジック ---
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
          const name = await getUserName(data.paidById); 
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
          const name = await getUserName(data.paidToId); 
          return { id: d.id, name: name, itemName: data.itemName, amount: data.amount };
        }));
        paymentSummary.value.payableTotal = total;
        paymentSummary.value.payableList = list;
      });
    }
  });

  fetchEvents(); 
});

onUnmounted(() => {
  if (unsubReceivable) unsubReceivable();
  if (unsubPayable) unsubPayable();
});

// 🌟 コピー完了の alert を美しいモーダルに！ (Eventブランチの機能)
const copyCode = (code) => {
  if (!code) {
    showModal({ type: 'error', title: 'エラー', message: 'コードがありません' });
    return;
  }
  navigator.clipboard.writeText(code)
    .then(() => {
      showModal({ type: 'success', title: 'コピー完了', message: '招待コードをコピーしました！LINE等でシェアしましょう。' });
    })
    .catch(() => {
      showModal({ type: 'error', title: 'エラー', message: 'コピーに失敗しました' });
    });
};

// 🌟 イベント削除の confirm と alert を美しいモーダルに！ (Eventブランチの機能)
const deleteEvent = async (id) => {
  showModal({
    type: 'warning',
    title: 'イベントの削除',
    message: 'このイベントを終了して削除しますか？\n（この操作は元に戻せません）',
    showCancel: true,
    confirmText: '削除する',
    onConfirm: async () => {
      try {
        // await api.delete(`/events/${id}`); 
        ongoingEvents.value = ongoingEvents.value.filter(e => e.id !== id);
        selectedEvent.value = null;

        setTimeout(() => {
          showModal({ type: 'success', title: '削除完了', message: 'イベントを終了しました。' });
        }, 300);

      } catch (error) {
        showModal({ type: 'error', title: 'エラー', message: '削除に失敗しました' });
      }
    }
  });
};

const goToEventDetail = (id) => {
  selectedEvent.value = null;
  router.push(`/event/${id}`);
};
</script>

<style scoped>
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

/* プラスボタン */
.add-button {
  position: fixed;
  right: 20px;
  bottom: 100px; 
  width: 60px;
  height: 60px;
  background-color: #2169a3; 
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 36px;
  display: flex;         
  align-items: center;     
  justify-content: center; 
  box-shadow: 0 4px 10px rgba(33,105,163,0.3);
  z-index: 999;          
  cursor: pointer;
  padding: 0;
  line-height: 1;        
  transition: transform 0.2s;
}
.add-button:active {
  transform: scale(0.95); 
}

/* モーダルデザイン */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 2000; padding: 20px; box-sizing: border-box; }
.detail-modal { background: white; width: 100%; max-width: 400px; border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-tag { background: #3b82f6; color: white; font-size: 12px; font-weight: bold; padding: 6px 16px; border-radius: 20px; }
.close-btn { background: none; border: none; font-size: 28px; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1; }
.modal-title { font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 25px 0; }
.modal-section { margin-bottom: 25px; }
.modal-section label { display: block; font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 8px; }
.modal-text { background: #f8fafc; padding: 16px; border-radius: 12px; font-size: 14px; color: #334155; font-weight: bold; border: 1px solid #e2e8f0; }
.modal-code-box { display: flex; justify-content: space-between; align-items: center; background: #2a4c7a; padding: 16px 20px; border-radius: 16px; }
.modal-code { color: white; font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; }
.modal-copy-btn { background: white; color: #2a4c7a; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: 0.2s; }
.modal-copy-btn:active { transform: scale(0.95); }
.modal-footer { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
.go-detail-btn { background: #10b981; color: white; border: none; padding: 16px; border-radius: 16px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(16,185,129,0.3); transition: 0.2s; }
.go-detail-btn:active { transform: scale(0.98); }
.delete-btn { background: white; border: 1.5px solid #ef4444; color: #ef4444; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.delete-btn:active { background: #fef2f2; }
.cancel-btn { background: #f1f5f9; color: #475569; border: none; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.cancel-btn:active { background: #e2e8f0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (min-width: 1024px) {
  .home-container { padding-bottom: 40px; }
  .add-button { display: none; }
}
</style>