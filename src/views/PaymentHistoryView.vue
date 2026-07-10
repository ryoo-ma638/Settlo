<template>
    <div class="history-page-container">
      <PageHeader title="お支払い履歴" fallback="/mypage" />
  
      <main class="content">
        <div class="seg">
          <button class="seg__item" :class="{ 'is-active': currentFilter === 'all' }" @click="currentFilter = 'all'">すべて</button>
          <button class="seg__item" :class="{ 'is-active': currentFilter === 'pay' }" @click="currentFilter = 'pay'">支払い</button>
          <button class="seg__item" :class="{ 'is-active': currentFilter === 'receive' }" @click="currentFilter = 'receive'">受取</button>
          <button class="seg__item" :class="{ 'is-active': currentFilter === 'completed' }" @click="currentFilter = 'completed'">完了</button>
        </div>
  
        <div class="history-list-area">
          <SkeletonRows v-if="loading" :rows="6" />
          <div
            v-for="item in filteredHistory"
            :key="item.id" 
            class="history-card"
            @click="goToDetail(item)"
          >
            <div class="card-left">
              <div class="avatar" :style="{ backgroundColor: item.color || '#cbd5e1' }">
                <img v-if="item.photo" :src="item.photo" class="avatar-img" />
              </div>
              <div class="info">
                <p class="name">{{ item.name }}</p>
                <p class="details">{{ item.date }} <span class="dot-separator">•</span> {{ item.eventName }}</p>
              </div>
            </div>
            
            <div class="card-right">
              <p class="amount" :class="item.type === 'pay' ? 'orange-text' : 'blue-text'">
                {{ item.type === 'pay' ? '-' : '+' }} ¥{{ item.amount.toLocaleString() }}
              </p>
              <span
                class="status-badge"
                :class="{ pending: item.status === 'unpaid', awaiting: item.status === 'awaiting_approval' }"
              >{{ statusLabel(item.status) }}</span>
            </div>
          </div>
          
          <div v-if="!loading && filteredHistory.length === 0" class="empty-box">
            該当する履歴がありません
          </div>
        </div>
      </main>
    </div>
  </template>
  
  <script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import PageHeader from '@/components/PageHeader.vue';
import SkeletonRows from '@/components/SkeletonRows.vue';

const router = useRouter(); // ルーターを準備
const currentFilter = ref('all');
const historyData = ref([]);
const loading = ref(true); // 履歴の初回読込中は true（スケルトン表示）

// 🌟 修正ポイント：フォーマット関数を onMounted より「上」に配置！（これでエラーが消えます）
const formatFullDate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return "日付未定"; // データが壊れている、または未作成の場合
  }
  const date = timestamp.toDate();
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
};

// 相手の名前・写真をキャッシュ付きで取得
const userCache = {};
const getUser = async (uid) => {
  if (!uid) return { name: '相手', photo: '' };
  if (userCache[uid]) return userCache[uid];
  try {
    const d = await getDoc(doc(db, "users", uid));
    const info = d.exists()
      ? { name: d.data().name || '相手', photo: d.data().photo || d.data().photoURL || '' }
      : { name: '相手', photo: '' };
    userCache[uid] = info;
    return info;
  } catch { return { name: '相手', photo: '' }; }
};

const statusLabel = (s) => s === 'completed' ? '決済完了' : (s === 'awaiting_approval' ? '承認待ち' : '未払い');

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (!user) { loading.value = false; return; }
    const myUid = user.uid;
    // 🌟 複合インデックス不要・確実に「自分関連の全取引」をリアルタイム取得（払う側＋受け取る側）
    const payMap = {};   // 自分が払う側
    const recvMap = {};  // 自分が受け取る側

    const rebuild = () => {
      historyData.value = [...Object.values(payMap), ...Object.values(recvMap)]
        .sort((a, b) => (b._ts || 0) - (a._ts || 0));
      loading.value = false; // 最初のスナップショットが届いたらスケルトン解除
    };

    onSnapshot(query(collection(db, "transactions"), where("paidById", "==", myUid)), async (snap) => {
      const ids = new Set();
      for (const d of snap.docs) {
        ids.add(d.id);
        const data = d.data();
        const info = await getUser(data.paidToId);
        payMap[d.id] = {
          id: d.id, date: formatFullDate(data.createdAt), name: info.name, photo: info.photo,
          eventName: data.itemName || 'イベント代', amount: data.amount || 0,
          type: 'pay', status: data.status || 'unpaid', color: '#fca5a5',
          _ts: data.createdAt?.seconds || 0
        };
      }
      Object.keys(payMap).forEach((id) => { if (!ids.has(id)) delete payMap[id]; });
      rebuild();
    });

    onSnapshot(query(collection(db, "transactions"), where("paidToId", "==", myUid)), async (snap) => {
      const ids = new Set();
      for (const d of snap.docs) {
        ids.add(d.id);
        const data = d.data();
        const info = await getUser(data.paidById);
        recvMap[d.id] = {
          id: d.id, date: formatFullDate(data.createdAt), name: info.name, photo: info.photo,
          eventName: data.itemName || 'イベント代', amount: data.amount || 0,
          type: 'receive', status: data.status || 'unpaid', color: '#93c5fd',
          _ts: data.createdAt?.seconds || 0
        };
      }
      Object.keys(recvMap).forEach((id) => { if (!ids.has(id)) delete recvMap[id]; });
      rebuild();
    });
  });
});

const filteredHistory = computed(() => {
  if (currentFilter.value === 'all') return historyData.value;
  if (currentFilter.value === 'pay') return historyData.value.filter(item => item.type === 'pay');
  if (currentFilter.value === 'receive') return historyData.value.filter(item => item.type === 'receive');
  if (currentFilter.value === 'completed') return historyData.value.filter(item => item.status === 'completed');
  return historyData.value;
});

// 🌟 カードがタップされた時の遷移ロジック
const goToDetail = (item) => {
  const prefix = item.type === 'receive' ? 'waiting' : 'unpaid';
  // 🌟 URLの最後に ?status=xxx をつけて、詳細画面に状態を教える
  router.push(`/payment-detail/${prefix}-${item.id}?status=${item.status}`);
};
</script>
  
  <style scoped>
/* PaymentHistoryView.vue の <style scoped> 一番上を上書き */
.history-page-container {
  background-color: var(--c-bg);
  width: 100%;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.detail-header { 
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; 
  background: linear-gradient(135deg, #fdf4ff 0%, #f3e8ff 100%); /* 🌟 淡いパープル系 */
  position: sticky; 
  z-index: 100;
  border-radius: 0 0 24px 24px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  margin-bottom: 15px;
}
.back-btn { background: none; border: none; font-size: 32px; color: var(--c-ink); cursor: pointer; padding: 0; display: flex; align-items: center; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.title { font-size: 18px; font-weight: 900; margin: 0; color: var(--c-ink); flex: 1; text-align: center; }
.spacer { width: 32px; }

.content { flex: 1; width: 100%; margin: 0 auto; padding: 8px var(--pad) 28px; box-sizing: border-box; display: flex; flex-direction: column; }
/* ↑ここまで上書き。以降は既存の .filter-tabs などが続きます */
  
  /* 🌟 iOS風のモダンな切り替えタブ */
  .filter-tabs { 
    display: flex; 
    background-color: var(--c-line-bold); 
    border-radius: 12px; 
    padding: 4px; 
    margin-bottom: 24px; 
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  }
  .filter-btn { 
    flex: 1; padding: 10px 0; border: none; background: transparent; 
    font-size: 12px; font-weight: bold; color: var(--c-text-sub); 
    border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
  }
  .filter-btn.active { 
    background-color: #fff; color: #2169a3; 
    box-shadow: 0 2px 5px rgba(0,0,0,0.08); 
    transform: scale(1.02);
  }
  
  /* 🌟 洗練された履歴カードデザイン */
  .history-list-area { flex: 1; display: flex; flex-direction: column; gap: 12px; }
  .history-card { 
    background-color: white; display: flex; justify-content: space-between; align-items: center; 
    padding: 16px 20px; border-radius: 20px; 
    box-shadow: 0 4px 10px rgba(0,0,0,0.03); 
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer; /* 今後タップできるように */
  }
  .history-card:active { transform: scale(0.98); background-color: var(--c-surface-2); }
  
  .card-left { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
  .avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .name { font-size: 16px; font-weight: bold; color: var(--c-text); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .details { font-size: 12px; color: var(--c-text-sub); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot-separator { margin: 0 6px; font-size: 10px; opacity: 0.5; }

  .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; padding-left: 10px; }
  .amount { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
  .blue-text { color: var(--c-receive); }
  .orange-text { color: var(--c-pay); }
  
  /* 🌟 ステータスバッジ（完了 / 未完了） */
  .status-badge { 
    font-size: 10px; background-color: #dcfce7; color: #16a34a; 
    padding: 4px 10px; border-radius: 12px; font-weight: bold; 
  }
  .status-badge.pending {
    background-color: var(--c-surface-2); color: var(--c-text-sub);
  }
  .status-badge.awaiting {
    background-color: var(--c-pay-weak); color: var(--c-pay-strong);
  }
  
  /* 🌟 データが空の時の表示 */
  .empty-msg { 
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--c-text-faint); font-weight: bold; margin-top: 60px; 
  }
  .empty-icon { font-size: 40px; margin-bottom: 15px; opacity: 0.5; }

  /* アバター枠の修正 */
.avatar { 
  width: 44px;   height: 44px;   border-radius: 50%;   flex-shrink: 0;   box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
  overflow: hidden; /* 画像を丸く切り抜く */  display: flex;  align-items: center;  justify-content: center;
}

/* 🌟 画像のスタイル追加 */
.avatar-img {
  width: 100%;  height: 100%;  object-fit: cover;
}
  </style>