<template>
  <div v-if="friend" class="friend-detail-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        
        <div class="user-info-block">
          <div class="main-avatar-wrapper">
            <img v-if="friend.photo" :src="friend.photo" class="main-avatar-img" />
            <div v-else class="default-avatar" :style="{ backgroundColor: friend.color }"></div>
          </div>
          <h1 class="user-name">{{ friend.name }}</h1>
        </div>
        <button class="delete-link-btn" @click="handleDeleteFriend">削除する</button>
      </header>

    <main class="scroll-content">
      <section class="total-balance-card" 
        @click="$router.push({ 
          path: '/combined-settlement/' + $route.params.name, 
          query: { uid: route.params.uid } 
        })"
      >
    <div class="balance-label">トータルの貸し借り</div>
    <div class="balance-main">
      <h2 class="balance-amount" :class="netBalance >= 0 ? 'blue-text' : 'orange-text'">
        {{ netBalance >= 0 ? '受け取る' : '支払う' }} ¥{{ Math.abs(netBalance).toLocaleString() }}
      </h2>
      <span class="arrow-icon">›</span>
    </div>
    <div class="balance-sub-info">
      <div class="sub-item"><span class="dot blue-dot"></span> お支払い待ち: ¥{{ waitingTotal.toLocaleString() }}</div>
      <div class="sub-item"><span class="dot orange-dot"></span> 未払い: ¥{{ unpaidTotal.toLocaleString() }}</div>
    </div>
  </section> 
  <h2 class="section-title">{{ friend.name }} さんとのお支払い状況</h2>

      <section class="status-section">
        <div class="status-header">
          <span class="status-badge blue-badge">お支払い待ち</span>
          <span class="total-amount blue-text">¥0</span>
          <button 
  class="action-btn red-btn pay-all-btn" 
  @click="$router.push('/payment-detail/batch-waiting')"
>
  まとめて催促する
</button>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'w'+n" class="event-card blue-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button 
  class="action-btn red-btn" 
  @click="$router.push('/payment-detail/waiting-' + n)"
>
  催促する
</button></div>
          </div>
        </div>
      </section>
      
      <section class="status-section">
        <div class="status-header">
          <span class="status-badge orange-badge">未払い</span>
          <span class="total-amount orange-text">¥0</span>
          <button 
  class="action-btn green-btn pay-all-btn" 
  @click="$router.push('/payment-detail/all')"
>
  まとめて支払う
</button>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'u'+n" class="event-card orange-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button 
  class="action-btn green-btn" 
  @click="$router.push('/payment-detail/unpaid-' + n)"
>
  支払いを完了させる
</button></div>
          </div>
        </div>
      </section>

      <section class="history-section">
        <button class="history-toggle-btn">{{ $route.params.name }} さんとの過去の履歴</button>
        <div class="history-list">
          <div v-for="n in 5" :key="'h'+n" class="history-card">
            <span class="history-event-name">イベント名{{n}}</span>
            <div class="history-flow">
              <div class="avatar history-me">
                <img v-if="myPhoto" :src="myPhoto" class="avatar-img" alt="me" />
                <div v-else class="avatar-placeholder" style="background-color: #d9a0a0;"></div>
              </div>
              <span class="arrow">→</span>
              <div class="avatar history-friend">
                <img v-if="friendPhoto" :src="friendPhoto" class="avatar-img" alt="friend" />
                <div v-else class="avatar-placeholder" style="background-color: #8bb4ff;"></div>
              </div>
            </div>
            <span class="history-amount">¥0</span>
            <span class="check-icon">✅</span>
          </div>
        </div>
      </section>
    </main>
    
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
  </div>

  <div v-else class="loading-state">
    <p>読み込み中、またはデータが見つかりません...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'; // 🌟 reactive追加
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 統一モーダル追加

const waitingTotal = ref(3500); 
const unpaidTotal = ref(4800);  
const route = useRoute();
const router = useRouter();

const myPhoto = ref("");
const friendPhoto = ref("");
const friend = ref(null);

const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);

// 🌟 モーダル状態管理
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

onMounted(async () => {
  const uid = route.query.uid || route.params.uid;
  const myUid = auth.currentUser?.uid;
  
  if (!uid || !myUid) return;

  try {
    const myDoc = await getDoc(doc(db, "users", myUid));
    if (myDoc.exists()) myPhoto.value = myDoc.data().photo || myDoc.data().photoURL || "";

    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      friend.value = data; 
      friendPhoto.value = data.photo || data.photoURL || "";
    }
  } catch (error) {
    console.error("データ取得中にエラーが発生しました:", error);
  }
});

// 🌟 フレンド削除 (ダサい confirm と alert を美しいモーダルに！)
const handleDeleteFriend = async () => {
  const friendName = route.params.name;
  const friendUid = route.params.uid; 
  const myUid = auth.currentUser?.uid;

  if (!myUid || !friendUid) {
    showModal({ type: 'error', title: 'エラー', message: 'ユーザー情報の取得に失敗しました。' });
    return;
  }

  showModal({
    type: 'warning',
    title: 'フレンド削除の確認',
    message: `${friendName} さんをフレンドから削除しますか？\n(相手のリストからもあなたが削除されます)`,
    showCancel: true,
    confirmText: '削除する',
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, "users", myUid, "friends", friendUid));
        await deleteDoc(doc(db, "users", friendUid, "friends", myUid));

        // 削除成功したら完了モーダルを出して、OKを押したら一覧に戻る
        showModal({
          type: 'success', title: '削除完了', message: `${friendName} さんを削除しました。`,
          onConfirm: () => router.push('/friend')
        });
      } catch (error) {
        console.error("削除エラー:", error);
        showModal({ type: 'error', title: 'エラー', message: '削除に失敗しました。' });
      }
    }
  });
};
</script>

<style scoped>
/* 🌟 コンテナ全体の余白を調整（共通ヘッダーの下に配置） */
.friend-detail-container { 
  height: 100vh; 
  padding-top: 60px; /* 🌟 共通ヘッダー（AppHeader）の高さ分ずらす */
  box-sizing: border-box;
  background-color: #f8fafc; 
  display: flex;
  flex-direction: column;
}

/* 🌟 ヘッダーをグラデーションでおしゃれに */
.detail-header { 
  flex-shrink: 0; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 20px 20px 25px; 
  background: linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%);
  border-radius: 0 0 30px 30px; 
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  margin-bottom: 15px;
}

.back-btn { background: none; border: none; font-size: 32px; color: #1e293b; cursor: pointer; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.user-info-block { display: flex; align-items: center; gap: 15px; }
.user-name { font-size: 22px; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: 0.5px; }
.delete-link-btn { background: rgba(255, 255, 255, 0.5); border: none; color: #ef4444; font-size: 12px; font-weight: 900; padding: 6px 12px; border-radius: 12px; cursor: pointer; transition: 0.2s; }
.delete-link-btn:active { background: #fee2e2; }

/* 🌟 アイコンの枠をリッチに */
.main-avatar-wrapper { padding: 3px; background: white; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
.main-avatar-img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; display: block; }
.default-avatar { width: 56px; height: 56px; border-radius: 50%; display: block; }

.scroll-content { flex: 1; overflow-y: auto; padding: 15px 20px; scrollbar-width: none; }
.scroll-content::-webkit-scrollbar { display: none; }

/* 🌟 トータル収支カードを洗練 */
.total-balance-card { background-color: #fff; border-radius: 28px; padding: 24px; margin-bottom: 25px; box-shadow: 0 8px 30px rgba(33, 105, 163, 0.08); cursor: pointer; text-align: center; border: 1px solid #f1f5f9; }
.balance-label { font-size: 13px; font-weight: 800; color: #64748b; margin-bottom: 12px; }
.balance-main { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
.balance-amount { font-size: 36px; font-weight: 900; margin: 0; letter-spacing: -1px; }
.arrow-icon { font-size: 24px; color: #cbd5e1; }
.balance-sub-info { font-size: 11px; color: #94a3b8; display: flex; justify-content: center; gap: 15px; background: #f8fafc; padding: 8px; border-radius: 12px; }
.sub-item { display: flex; align-items: center; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.blue-dot { background-color: #3b82f6; }
.orange-dot { background-color: #f59e0b; }

.section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: left; }
.status-section { background-color: #fff; border-radius: 20px; padding: 15px; margin-bottom: 20px; }
.status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; position: relative; }
.status-badge { padding: 4px 12px; border-radius: 15px; color: white; font-size: 11px; font-weight: bold; }
.blue-badge { background-color: #3b82f6; }
.orange-badge { background-color: #f59e0b; }
.total-amount { font-size: 28px; font-weight: bold; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.pay-all-btn { position: absolute; right: 0; }

.event-list { display: flex; flex-direction: column; gap: 10px; }
.event-card { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-radius: 12px; }
.blue-card { background-color: #e0f2fe; }
.orange-card { background-color: #ffedd5; }
.event-info { display: flex; flex-direction: column; text-align: left; }
.event-date { font-size: 11px; color: #666; }
.event-name { font-size: 15px; font-weight: bold; }
.event-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.event-amount { font-size: 16px; font-weight: bold; }
.action-btn { padding: 5px 12px; border-radius: 20px; border: none; font-size: 11px; font-weight: bold; color: #fff; cursor: pointer; }
.green-btn { background-color: #22c55e; }
.red-btn { background-color: #ef4444; color: #ffffff; }

.history-toggle-btn { width: 100%; padding: 12px; background-color: #93c5fd; color: #fff; border: none; border-radius: 15px; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
.history-card { background-color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 40px; margin-bottom: 10px; }
.history-event-name { font-size: 16px; font-weight: bold; }
.history-flow { display: flex; align-items: center; gap: 8px; }
.avatar { width: 25px; height: 25px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #dcdcdc; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { width: 100%; height: 100%; }
.history-amount { font-size: 18px; font-weight: bold; }
.check-icon { color: #22c55e; }
</style>