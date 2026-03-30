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

      <section v-if="isCompleted" class="completed-section">
        <div class="completed-card">
          <span class="completed-icon">✅</span>
          <h3 class="completed-title">この取引は完了しています</h3>
          <p class="completed-date">支払い完了日: {{ completedDate }}</p>
        </div>
      </section>

      <template v-else>
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
            💵 {{ mode === 'remind' ? '現金で受け取った (完了にする)' : '現金で支払った (承認リクエスト)' }}
          </button>
        </footer>
      </template>
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
import PaymentReceipt from '../components/PaymentReceipt.vue';
import BatchItemList from '../components/BatchItemList.vue';

const route = useRoute();
const selectedItem = ref(null);

const isCompleted = computed(() => route.query.status === 'completed');
const completedDate = ref('2026/03/25 14:30'); 

// 判定ロジック
const mode = computed(() => route.params.id?.includes('waiting') ? 'remind' : 'pay');
// 🌟 `event` が含まれる場合も「まとめ払い」として扱う
const isBatch = computed(() => route.params.id?.includes('batch') || route.params.id === 'all' || route.params.id?.includes('event'));

const modeLabel = computed(() => mode.value === 'remind' ? 'ご請求合計' : 'お支払い合計');
const modeClass = computed(() => mode.value === 'remind' ? 'blue-mode' : 'orange-mode');

// 🌟 タイトルを動的に変化
const pageTitle = computed(() => {
  if (mode.value === 'remind') {
    return route.params.id?.includes('event') ? 'イベントのまとめて受け取り' : (isBatch.value ? 'まとめて催促' : '催促の詳細');
  } else {
    return route.params.id?.includes('event') ? 'イベントのまとめてお支払い' : (isBatch.value ? 'まとめてお支払い' : 'お支払いの詳細');
  }
});

const items = ref([
  { id: 1, eventName: '鈴○サーキット', date: '3/25', name: '小野木涼平', itemName: 'レンタカー代', amount: 1500, itemsDetail: ['基本料金', 'ガソリン代'] },
  { id: 2, eventName: '鈴○サーキット', date: '3/25', name: '小野木涼平', itemName: '高速料金', amount: 2000, itemsDetail: ['ETC代'] },
]);

const totalAmount = computed(() => items.value.reduce((sum, i) => sum + i.amount, 0));
const openOverlay = (item) => { selectedItem.value = item; };

const confirmCash = () => {
  if (mode.value === 'remind') {
    if (confirm("現金で受け取りましたか？\n相手の支払い状況を「完了」に更新します。")) alert("受け取りを完了しました！");
  } else {
    if (confirm("現金で支払いましたか？\n相手に「受け取り完了の承認リクエスト」を送ります。")) alert("承認リクエストを送信しました！");
  }
};

const createPayPayLink = () => {
  alert(`¥${totalAmount.value.toLocaleString()} のPayPay請求リンクを作成しコピーしました！`);
};
const confirmPayment = (method) => {
  if (method === 'paypay') alert("PayPayアプリを起動します（現在準備中）");
};
</script>

<style scoped>
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

.completed-section { margin-top: 30px; }
.completed-card { 
  background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; 
  padding: 25px; text-align: center; color: #166534; box-shadow: 0 4px 10px rgba(0,0,0,0.02); 
}
.completed-icon { font-size: 32px; display: block; margin-bottom: 10px; }
.completed-title { font-size: 16px; font-weight: bold; margin: 0 0 5px 0; }
.completed-date { font-size: 12px; opacity: 0.8; margin: 0; }
</style>