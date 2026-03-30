<template>
    <div class="history-page-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        <h1 class="title">お支払い履歴</h1>
        <div class="spacer"></div>
      </header>
  
      <main class="content">
        <div class="filter-tabs">
          <button class="filter-btn" :class="{ active: currentFilter === 'all' }" @click="currentFilter = 'all'">すべて</button>
          <button class="filter-btn" :class="{ active: currentFilter === 'pay' }" @click="currentFilter = 'pay'">支払い</button>
          <button class="filter-btn" :class="{ active: currentFilter === 'receive' }" @click="currentFilter = 'receive'">受け取り</button>
          <button class="filter-btn" :class="{ active: currentFilter === 'completed' }" @click="currentFilter = 'completed'">決済完了</button>
        </div>
  
        <div class="history-list-area">
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
              <span v-if="item.status === 'completed'" class="status-badge">決済完了</span>
              <span v-else class="status-badge pending">未完了</span>
            </div>
          </div>
          
          <div v-if="filteredHistory.length === 0" class="empty-msg">
            <div class="empty-icon">📂</div>
            <p>該当する履歴がありません</p>
          </div>
        </div>
      </main>
    </div>
  </template>
  
  <script setup>
  import { ref, computed , onMounted} from 'vue';
  // 🌟 追加：ルーターを使うためのインポート
  import { useRouter } from 'vue-router';
  import { db, auth } from '@/firebase'; // 🌟 追加

  import { onAuthStateChanged } from 'firebase/auth';
  import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
  
  const router = useRouter(); // ルーターを準備
  const currentFilter = ref('all');
  // 🌟 ダミーデータを空にして、Firestoreからのデータを格納する
  const historyData = ref([]);
  /*
  const historyData = ref([
    { id: 1, date: '2026/03/25', name: '天野 椋祐', eventName: 'カフェ代', amount: 800, type: 'receive', status: 'pending', color: '#93c5fd' },
    { id: 2, date: '2026/03/24', name: '大崎 稜馬', eventName: '飲み会代', amount: 6300, type: 'pay', status: 'completed', color: '#fca5a5' },
    { id: 3, date: '2026/03/20', name: '中橋 楓華', eventName: 'ランチ代', amount: 1200, type: 'receive', status: 'completed', color: '#bbf7d0' },
    { id: 4, date: '2026/03/18', name: '小野木 涼平', eventName: 'レンタカー代', amount: 2000, type: 'pay', status: 'pending', color: '#fde047' },
    { id: 5, date: '2026/03/15', name: '松岡 暖來', eventName: 'タクシー代', amount: 1500, type: 'receive', status: 'completed', color: '#f9a8d4' },
  ]);
  */

  onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const myUid = user.uid;

      // 🌟 自分が「払う側」または「受け取る側」である取引をすべて監視
      // 注: Firestoreの制限上、OR条件は 'whereIn' などを使いますが、
      // ここではシンプルに自分に関係する取引を status 問わず取得します
      const q = query(
        collection(db, "transactions"),
        orderBy("createdAt", "desc") // 新しい順に並べる
      );

      onSnapshot(q, async (snapshot) => {
        const list = [];
        
        for (const transactionDoc of snapshot.docs) {
          const data = transactionDoc.data();
          
          // 自分に関係ないデータはスキップ
          if (data.paidById !== myUid && data.paidToId !== myUid) continue;

          // 相手のUIDを特定
          const isPay = data.paidById === myUid;
          const otherUid = isPay ? data.paidToId : data.paidById;

          // 相手の情報を取得
          let otherName = isPay ? (data.paidToName || "相手") : (data.paidByName || "相手");
          let otherPhoto = "";
          let otherColor = isPay ? "#fca5a5" : "#93c5fd";

          const userDoc = await getDoc(doc(db, "users", otherUid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            otherName = userData.name || otherName;
            otherPhoto = userData.photo || userData.photoURL || "";
          }

          list.push({
            id: transactionDoc.id,
            date: formatFullDate(data.createdAt),
            name: otherName,
            eventName: data.itemName || "イベント代",
            amount: data.amount || 0,
            type: isPay ? 'pay' : 'receive', // 自分が払うなら 'pay'
            status: data.status || 'pending',
            photo: otherPhoto,
            color: otherColor
          });
        }
        historyData.value = list;
      });
    }
  });
});

// 日付フォーマット関数
  // formatFullDate を以下に書き換え
const formatFullDate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return "日付未定"; // データが壊れている、または未作成の場合
  }
  const date = timestamp.toDate();
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
};

  const filteredHistory = computed(() => {
    if (currentFilter.value === 'all') return historyData.value;
    if (currentFilter.value === 'pay') return historyData.value.filter(item => item.type === 'pay');
    if (currentFilter.value === 'receive') return historyData.value.filter(item => item.type === 'receive');
    if (currentFilter.value === 'completed') return historyData.value.filter(item => item.status === 'completed');
    return historyData.value;
  });
  
  // 🌟 追加：カードがタップされた時の遷移ロジック
  const goToDetail = (item) => {
  const prefix = item.type === 'receive' ? 'waiting' : 'unpaid';
  // 🌟 URLの最後に ?status=xxx をつけて、詳細画面に状態を教える
  router.push(`/payment-detail/${prefix}-${item.id}?status=${item.status}`);
};
  </script>
  
  <style scoped>
  /* 🌟 大外のコンテナ：横揺れ・見切れを完全に防止 */
  .history-page-container { 
    background-color: #f0f4f8; /* アプリ全体の統一背景色 */
    min-height: 100vh; 
    width: 100%; 
    overflow-x: hidden; 
    display: flex; 
    flex-direction: column; 
  }
  
  /* 🌟 ヘッダー：スクロールしても上にピタッとくっつく（半透明ぼかし） */
  .detail-header { 
    display: flex; align-items: center; justify-content: space-between;
    padding: 15px 20px; 
    background: rgba(255, 255, 255, 0.85); 
    backdrop-filter: blur(10px); /* 磨りガラス効果 */
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid rgba(0,0,0,0.05);
  }
  .back-btn { background: none; border: none; font-size: 32px; color: #64748b; cursor: pointer; padding: 0; display: flex; align-items: center; }
  .title { font-size: 18px; font-weight: bold; margin: 0; color: #1e293b; position: absolute; left: 50%; transform: translateX(-50%); }
  
  /* 🌟 メインコンテンツ：中央揃えの要 */
  .content { 
    flex: 1; 
    width: 100%; 
    max-width: 600px; /* PC版でも横に広がりすぎない */
    margin: 0 auto; /* 左右の余白を均等にしてド真ん中に配置 */
    padding: 20px 20px 100px 20px; /* 下部フッターの被り防止（100px） */
    box-sizing: border-box; /* paddingを含めて幅を計算（見切れ防止） */
    display: flex; 
    flex-direction: column; 
  }
  
  /* 🌟 iOS風のモダンな切り替えタブ */
  .filter-tabs { 
    display: flex; 
    background-color: #e2e8f0; 
    border-radius: 12px; 
    padding: 4px; 
    margin-bottom: 24px; 
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  }
  .filter-btn { 
    flex: 1; padding: 10px 0; border: none; background: transparent; 
    font-size: 12px; font-weight: bold; color: #64748b; 
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
  .history-card:active { transform: scale(0.98); background-color: #f8fafc; }
  
  .card-left { display: flex; align-items: center; gap: 15px; }
  .avatar { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .info { display: flex; flex-direction: column; gap: 4px; }
  .name { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0; }
  .details { font-size: 12px; color: #64748b; margin: 0; display: flex; align-items: center; }
  .dot-separator { margin: 0 6px; font-size: 10px; opacity: 0.5; }
  
  .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .amount { font-size: 18px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
  .blue-text { color: #3b82f6; } 
  .orange-text { color: #f59e0b; }
  
  /* 🌟 ステータスバッジ（完了 / 未完了） */
  .status-badge { 
    font-size: 10px; background-color: #dcfce7; color: #16a34a; 
    padding: 4px 10px; border-radius: 12px; font-weight: bold; 
  }
  .status-badge.pending { 
    background-color: #f1f5f9; color: #64748b; 
  }
  
  /* 🌟 データが空の時の表示 */
  .empty-msg { 
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #94a3b8; font-weight: bold; margin-top: 60px; 
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