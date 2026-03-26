<template>
    <div class="action-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        <h1 class="title">トータル精算の実行</h1>
        <div class="spacer"></div>
      </header>
  
      <main class="content">
        <div class="summary-card" :class="isRemind ? 'blue-mode' : 'orange-mode'">
          <p class="summary-label">{{ $route.params.name }} さん{{ isRemind ? 'へ請求する' : 'に支払う' }}金額</p>
          <h2 class="total-amount">¥{{ Number($route.query.amount).toLocaleString() }}</h2>
          <p class="hint-badge">複数の貸し借りを相殺した金額です</p>
        </div>
  
        <section v-if="isRemind" class="action-section">
          <h3 class="section-sub">相手に請求する</h3>
          <button @click="createPayPayLink" class="method-btn paypay">
            📱 PayPayで請求リンクを作成
          </button>
        </section>
        
        <section v-else class="action-section">
          <h3 class="section-sub">アプリで決済</h3>
          <button @click="confirmPayment('paypay')" class="method-btn paypay">
            📱 PayPayで支払う (準備中)
          </button>
        </section>
  
        <footer class="footer-actions">
          <h3 class="section-sub">手渡しの場合</h3>
          <button class="method-btn cash" @click="confirmCash">
            💵 {{ isRemind ? '現金で受け取った (承認リクエスト)' : '現金で支払った (承認リクエスト)' }}
          </button>
        </footer>
      </main>
    </div>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  
  const route = useRoute();
  const isRemind = computed(() => route.query.type === 'remind');
  const amount = computed(() => route.query.amount);
  
  const confirmCash = () => {
    const msg = isRemind.value 
      ? "現金で受け取りましたか？\n「支払い完了の承認リクエスト」を送ります。"
      : "現金で支払いましたか？\n「受け取り完了の承認リクエスト」を送ります。";
    if (confirm(msg)) alert("承認リクエストを送信しました！");
  };
  
  const createPayPayLink = () => {
    alert(`¥${amount.value} のPayPay請求リンクを作成しました！\n相殺済みの金額です。`);
  };
  
  const confirmPayment = () => {
    alert("PayPayアプリを起動します");
  };
  </script>
  
  <style scoped>
  .action-container { background: #f8fafc; min-height: 100vh; width: 100%; box-sizing: border-box; }
  .content { padding: 20px; }
  .summary-card { padding: 30px; border-radius: 20px; color: white; text-align: center; margin-bottom: 25px; }
  .blue-mode { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  .orange-mode { background: linear-gradient(135deg, #f59e0b, #d97706); }
  .summary-label { font-size: 14px; margin-bottom: 5px; opacity: 0.9; }
  .total-amount { font-size: 44px; font-weight: bold; margin: 0 0 10px 0; }
  .hint-badge { background: rgba(255,255,255,0.2); display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; }
  
  .section-sub { font-size: 16px; font-weight: bold; margin: 20px 0 10px; color: #1e293b; }
  .method-btn { width: 100%; padding: 16px; border-radius: 14px; border: none; font-weight: bold; font-size: 16px; cursor: pointer; }
  .cash { background-color: #1e293b; color: white; }
  .paypay { background-color: #ff0033; color: white; }
  .footer-actions { margin-top: 30px; }
  .detail-header { display: flex; align-items: center; padding: 10px 15px; background: white; }
  .back-btn { background: none; border: none; font-size: 32px; color: #64748b; }
  </style>