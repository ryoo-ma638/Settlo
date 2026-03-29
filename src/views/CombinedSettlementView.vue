<template>
    <div class="combined-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        <h1 class="title">トータル精算</h1>
        <div class="spacer"></div>
      </header>
  
      <main class="content">
        <div class="final-card" :class="netBalance >= 0 ? 'receive-bg' : 'pay-bg'">
          <p class="label">{{ netBalance >= 0 ? 'あなたへの未払い（受け取る）' : 'あなたからの未払い（支払う）' }}</p>
          <h2 class="amount">¥{{ Math.abs(netBalance).toLocaleString() }}</h2>
          <div class="settle-route">
            <div class="avatar-me"></div>
            <span class="route-arrow">{{ netBalance >= 0 ? '←' : '→' }}</span>
            <div class="avatar-friend" style="background-color: #ff9980;"></div>
          </div>
        </div>
  
        <section class="breakdown-section">
          <div class="section-header">
            <h3 class="section-sub">合算の内訳</h3>
            <button v-if="filterType !== 'all'" class="reset-filter-btn" @click="filterType = 'all'">すべて表示</button>
          </div>
          
          <div class="comparison-row">
            <div class="comp-box blue-border" :class="{ 'active-box': filterType === 'waiting' }" @click="filterType = 'waiting'">
              <span>お支払い待ち</span>
              <strong>¥{{ waitingTotal.toLocaleString() }}</strong>
            </div>
            <div class="comp-operator">ー</div>
            <div class="comp-box orange-border" :class="{ 'active-box': filterType === 'pay' }" @click="filterType = 'pay'">
              <span>未払い</span>
              <strong>¥{{ unpaidTotal.toLocaleString() }}</strong>
            </div>
          </div>
  
          <div class="event-history">
            <p class="history-label">対象のイベント一覧（タップで詳細）</p>
            <div 
              v-for="item in displayedEvents" 
              :key="item.id" 
              class="history-item" 
              :class="{ 'excluded-item': !item.included }"
              @click="openDetailOverlay(item)"
            >
              <button class="toggle-btn" @click.stop="toggleInclude(item)">
                {{ item.included ? '➖' : '➕' }}
              </button>
              <div class="item-info">
                <span class="badge" :class="item.type">{{ item.type === 'waiting' ? '受' : '払' }}</span>
                <span class="name">{{ item.eventName }}</span>
              </div>
              <span class="price">¥{{ item.amount.toLocaleString() }}</span>
            </div>
          </div>
        </section>
  
        <footer class="footer-actions">
          <button v-if="netBalance >= 0" class="main-btn blue-btn" @click="goToActionPage('remind')">
            ¥{{ Math.abs(netBalance).toLocaleString() }} をまとめて催促する
          </button>
          <button v-else class="main-btn orange-btn" @click="goToActionPage('pay')">
            ¥{{ Math.abs(netBalance).toLocaleString() }} をまとめて支払う
          </button>
        </footer>
      </main>
  
      <Teleport to="body">
        <div v-if="selectedItem" class="overlay" @click.self="selectedItem = null">
          <div class="overlay-content">
            <button class="close-overlay" @click="selectedItem = null">×</button>
            <PaymentReceipt :item="selectedItem" />
            <button class="main-btn close-btn" @click="selectedItem = null">閉じる</button>
          </div>
        </div>
      </Teleport>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import PaymentReceipt from '../components/PaymentReceipt.vue'; // 🌟 コンポーネントをインポート
  
  const route = useRoute();
  const router = useRouter();
  
  // 🌟 データの構造化 (included: true で計算対象にする)
  const allEvents = ref([
    { id: 1, type: 'waiting', eventName: 'ランチ代', date: '3/10', name: route.params.name, itemName: '立て替え', amount: 1500, itemsDetail: ['パスタ', 'コーヒー'], included: true },
    { id: 2, type: 'waiting', eventName: 'カフェ代', date: '3/11', name: route.params.name, itemName: '立て替え', amount: 2000, itemsDetail: ['ケーキ', '紅茶'], included: true },
    { id: 3, type: 'pay', eventName: '飲み会代', date: '3/12', name: route.params.name, itemName: '飲み代', amount: 4800, itemsDetail: ['コース', '飲み放題'], included: true },
  ]);
  
  // 🌟 動的計算（included が true のものだけ合算）
  const waitingTotal = computed(() => allEvents.value.filter(e => e.type === 'waiting' && e.included).reduce((sum, e) => sum + e.amount, 0));
  const unpaidTotal = computed(() => allEvents.value.filter(e => e.type === 'pay' && e.included).reduce((sum, e) => sum + e.amount, 0));
  const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);
  
  // 🌟 絞り込み機能
  const filterType = ref('all'); // 'all', 'waiting', 'pay'
  const displayedEvents = computed(() => {
    if (filterType.value === 'all') return allEvents.value;
    return allEvents.value.filter(e => e.type === filterType.value);
  });
  
  // 🌟 除外/追加 トグル機能
  const toggleInclude = (item) => {
    const action = item.included ? '除外' : '追加';
    if (confirm(`このイベントを今回の精算から${action}しますか？`)) {
      item.included = !item.included;
    }
  };
  
  // 詳細表示
  const selectedItem = ref(null);
  const openDetailOverlay = (item) => { selectedItem.value = item; };
  
  // 🌟 新設した「相殺専用のアクションページ」へ遷移
  const goToActionPage = (actionType) => {
    // 本来はIDや金額をパラメータで渡しますが、今回はシンプルに名前とタイプを渡します
    router.push(`/combined-action/${route.params.name}?type=${actionType}&amount=${Math.abs(netBalance.value)}`);
  };
  </script>
  
  <style scoped>
  .combined-container { background: #f8fafc; min-height: 100vh; width: 100%; box-sizing: border-box; }
  .content { padding: 20px; box-sizing: border-box; }
  
  .final-card { border-radius: 25px; padding: 30px; color: white; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.1); margin-bottom: 25px; transition: all 0.3s; }
  .receive-bg { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  .pay-bg { background: linear-gradient(135deg, #f59e0b, #d97706); }
  .amount { font-size: 44px; font-weight: bold; margin: 15px 0; }
  .settle-route { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 10px; }
  .avatar-me, .avatar-friend { width: 50px; height: 50px; border-radius: 50%; background: #dcdcdc; border: 3px solid white; }
  .route-arrow { font-size: 30px; font-weight: bold; }
  
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .section-sub { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0; }
  .reset-filter-btn { font-size: 12px; background: #e2e8f0; border: none; padding: 4px 10px; border-radius: 12px; cursor: pointer; }
  
  .comparison-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .comp-box { flex: 1; background: white; padding: 15px; border-radius: 15px; display: flex; flex-direction: column; border-bottom: 4px solid; cursor: pointer; transition: 0.2s; opacity: 0.6; }
  .active-box { opacity: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transform: translateY(-2px); }
  .blue-border { border-color: #3b82f6; }
  .orange-border { border-color: #f59e0b; }
  .comp-operator { padding: 0 10px; font-weight: bold; color: #94a3b8; }
  
  .event-history { background: white; border-radius: 20px; padding: 20px; }
  .history-label { font-size: 12px; color: #94a3b8; margin-bottom: 10px; }
  .history-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: 0.3s; }
  .excluded-item { opacity: 0.4; text-decoration: line-through; } /* 🌟 除外された項目のスタイル */
  
  .toggle-btn { background: #f1f5f9; border: none; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; margin-right: 10px; cursor: pointer; font-size: 10px; }
  .item-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; color: white; }
  .waiting { background: #3b82f6; }
  .pay { background: #f59e0b; }
  .price { font-weight: bold; }
  
  .main-btn { width: 100%; padding: 18px; border-radius: 18px; border: none; font-weight: bold; font-size: 16px; color: white; cursor: pointer; margin-top: 20px; }
  .blue-btn { background: #2169a3; }
  .orange-btn { background: #f59e0b; }
  .close-btn { background: #1e293b; }
  
  /* オーバーレイ */
  .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 3000; }
  .overlay-content { background: #f8fafc; width: 100%; padding: 30px; border-radius: 30px 30px 0 0; position: relative; }
  .close-overlay { position: absolute; top: -40px; right: 20px; font-size: 30px; border: none; background: none; color: white; }

  /* 🌟 戻るボタンのスタイル追加 */
.detail-header {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background: white;
}
.back-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #64748b;
  cursor: pointer;
}

.spacer {
  display: none; /* spacer は padding-right で代用するため非表示 */
}
  </style>