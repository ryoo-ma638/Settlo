<template>
    <div class="payment-detail-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        <h1 class="title">{{ pageTitle }}</h1>
        <div class="spacer"></div>
      </header>
  
      <main class="content">
      <div class="summary-card" :class="modeClass">
        <p class="summary-label">{{ modeLabel }}</p>
        <h2 class="total-amount">¥{{ totalAmount.toLocaleString() }}</h2>
        <p v-if="isBatch" class="count-badge">内訳: {{ items.length }}件</p>
      </div>

      <PaymentReceipt v-if="!isBatch" :item="items[0]" />
      <BatchItemList v-else :items="items" @select="openOverlay" />

      <section v-if="mode === 'remind'" class="action-section">
        <h3 class="section-sub">相手に請求する</h3>
        <p class="hint">PayPayの請求リンクを作成してLINE等で送れます。</p>
        <button @click="createPayPayLink" class="method-btn paypay">
          📱 PayPayで請求リンクを作成
        </button>
      </section>

      <section v-if="mode === 'pay'" class="action-section">
        <h3 class="section-sub">アプリで決済</h3>
        <button @click="confirmPayment('paypay')" class="method-btn paypay">
          📱 PayPayで支払う (準備中)
        </button>
      </section>

      <footer class="footer-actions">
        <h3 class="section-sub">手渡しの場合</h3>
        <button class="method-btn cash" @click="confirmCash">
          💵 {{ mode === 'remind' ? '現金で受け取った (承認リクエスト)' : '現金で支払った (承認リクエスト)' }}
        </button>
      </footer>
    </main>
  
      <Teleport to="body">
        <div v-if="selectedItem" class="overlay" @click.self="selectedItem = null">
          <div class="overlay-content">
            <button class="close-overlay" @click="selectedItem = null">×</button>
            <PaymentReceipt :item="selectedItem" />
            <button class="main-btn" @click="selectedItem = null">閉じる</button>
          </div>
        </div>
      </Teleport>
    </div>
  </template>
  
  <script setup>
  import { ref, computed } from 'vue';
  import { useRoute } from 'vue-router';
  // 🌟 作成したコンポーネントをインポート
  import PaymentReceipt from '../components/PaymentReceipt.vue';
  import BatchItemList from '../components/BatchItemList.vue';
  
  const route = useRoute();
  const selectedItem = ref(null);
  
  // 判定ロジック
  const mode = computed(() => route.params.id?.includes('waiting') ? 'remind' : 'pay');
  const isBatch = computed(() => route.params.id?.includes('batch') || route.params.id === 'all');
  const modeLabel = computed(() => mode.value === 'remind' ? 'ご請求合計' : 'お支払い合計');
  const modeClass = computed(() => mode.value === 'remind' ? 'blue-mode' : 'orange-mode');
  const pageTitle = computed(() => mode.value === 'remind' ? (isBatch.value ? 'まとめて催促' : '催促の詳細') : (isBatch.value ? 'まとめてお支払い' : 'お支払いの詳細'));
  
  const items = ref([
    { id: 1, eventName: 'スノボ旅行', date: '3/10', name: '小野木涼平', itemName: 'レンタカー代', amount: 2000, itemsDetail: ['基本料金', 'スタッドレス'] },
    { id: 2, eventName: '飲み会', date: '3/11', name: '大崎稜馬', itemName: '飲み会代', amount: 6300, itemsDetail: ['コース代', '飲み放題'] },
  ]);
  
  const totalAmount = computed(() => items.value.reduce((sum, i) => sum + i.amount, 0));
  const openOverlay = (item) => { selectedItem.value = item; };
  
  // 🌟 1. 現金やり取りのツー・ステップ承認リクエスト
  const confirmCash = () => {
    if (mode.value === 'remind') {
      const ok = confirm("現金で受け取りましたか？\n相手に「支払い完了の承認リクエスト」を送ります。");
      if (ok) alert("承認リクエストを送信しました！相手が承認すると完了になります。");
    } else {
      const ok = confirm("現金で支払いましたか？\n相手に「受け取り完了の承認リクエスト」を送ります。");
      if (ok) alert("承認リクエストを送信しました！相手が承認すると完了になります。");
    }
  };
  
  // 🌟 2. PayPayの請求リンク作成 (催促モード用)
  const createPayPayLink = () => {
    alert(`¥${totalAmount.value.toLocaleString()} のPayPay請求リンクを作成し、クリップボードにコピーしました！\nLINE等で送信してください。`);
  };
  
  // 🌟 3. PayPayでの支払い (支払いモード用)
  const confirmPayment = (method) => {
    if (method === 'paypay') {
      alert("PayPayアプリを起動します（現在準備中）");
    }
  };
  </script>
  
  <style scoped>
  /* App.vueで見切れるのを防ぐための設定は継承 */
  .payment-detail-container { width: 100%; min-height: 100vh; background-color: #f8fafc; display: flex; flex-direction: column; box-sizing: border-box; overflow-x: hidden; }
  .content { padding: 15px; width: 100%; box-sizing: border-box; }
  .summary-card { padding: 25px; border-radius: 20px; color: white; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
  .blue-mode { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  .orange-mode { background: linear-gradient(135deg, #f59e0b, #d97706); }
  .total-amount { font-size: 36px; font-weight: bold; margin: 5px 0; }
  .section-sub { font-size: 16px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; text-align: left; }
  .link-box { background: white; padding: 12px; border-radius: 12px; display: flex; gap: 8px; border: 1px dashed #cbd5e1; }
  .link-text { flex: 1; font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .footer-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 30px; }
  .method-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; font-weight: bold; cursor: pointer; }
  .cash { background-color: #1e293b; color: white; }
  .paypay { background-color: #ff0033; color: white; }
  .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 3000; }
  .overlay-content { background: white; width: 100%; padding: 30px; border-radius: 30px 30px 0 0; position: relative; }
  .close-overlay { position: absolute; top: 15px; right: 15px; font-size: 24px; border: none; background: none; color: #cbd5e1; }
  .main-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; background: #1e293b; color: white; font-weight: bold; margin-top: 20px; }
  .back-btn { background: none; border: none; font-size: 32px; color: #64748b; }
  .detail-header { display: flex; align-items: center; padding: 10px 15px; background: white; }
  </style>