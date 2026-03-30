<template>
  <Teleport to="body">
    <div v-if="isOpen && history" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content slide-up receipt-style">
        <div class="modal-header">
          <h3>取引の詳細・決済</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
        
        <div class="receipt-body">
          <div class="r-icon" :style="{ backgroundColor: history.color }"></div>
          <h2>{{ history.itemName }}</h2>
          <p class="r-date">{{ history.date }} {{ history.time }} • {{ history.splitType }}</p>
          <h1 class="r-amount">¥{{ history.amount.toLocaleString() }}</h1>
          
          <div v-if="history.items && history.items.length > 0" class="receipt-paper">
            <div class="receipt-paper-header">購入した内訳</div>
            <div class="receipt-items-list">
              <div class="receipt-item" v-for="(item, index) in history.items" :key="index">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-price">¥{{ item.price.toLocaleString() }}</span>
              </div>
            </div>
            <div class="receipt-divider"></div>
            <div class="receipt-total">
              <span>合計</span>
              <span>¥{{ history.amount.toLocaleString() }}</span>
            </div>
          </div>
          
          <section v-if="history.status === 'completed'" class="completed-section">
            <div class="completed-card">
              <span class="completed-icon">✅</span>
              <h3 class="completed-title">この取引は完了しています</h3>
              <p class="completed-date">支払い完了日: {{ history.date }} {{ history.time }}</p>
            </div>
          </section>

          <template v-else>
            <div class="r-status unpaid">未完済の取引です</div>
            <div class="payment-actions">
              <p class="hint">この画面から決済を完了できます</p>
              <button class="method-btn paypay" @click="handlePayment('paypay')">📱 PayPayで支払う/請求</button>
              <button class="method-btn cash" @click="handlePayment('cash')">💵 支払った/受け取った</button>
            </div>
          </template>

          <button class="action-btn" @click="$emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  isOpen: Boolean,
  history: Object
});
const emit = defineEmits(['close', 'complete']);

const handlePayment = (method) => {
  const methodText = method === 'paypay' ? 'PayPayアプリを起動して決済しますか？' : '精算を完了しますか？\n（相手に承認リクエストが送信されます）';
  if(confirm(methodText)) {
    emit('complete', props.history.id);
    alert('決済（リクエスト）を完了しました！');
  }
};
</script>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2010; backdrop-filter: blur(2px); }
.modal-content { background: #f8fafc; width: 100%; max-width: 600px; border-radius: 30px 30px 0 0; padding: 25px; box-sizing: border-box; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 900; }
.close-btn { background: #e2e8f0; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.receipt-style { text-align: center; }
.r-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.receipt-body h2 { margin: 0 0 5px; font-size: 22px; color: #1e293b; font-weight: 900; }
.r-date { color: #64748b; font-size: 13px; margin: 0 0 20px; font-weight: 700; }
.r-amount { font-size: 40px; margin: 0 0 15px; letter-spacing: -1px; font-weight: 900; }

/* 🌟 追加：レシート内訳のデザイン */
.receipt-paper {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 16px;
  padding: 20px;
  margin: 20px 0;
  text-align: left;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}
.receipt-paper-header {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 800;
  margin-bottom: 16px;
  text-align: center;
  letter-spacing: 2px;
}
.receipt-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.receipt-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
  color: #334155;
  font-weight: 700;
}
.item-name {
  flex: 1;
  padding-right: 12px;
  /* 長い商品名を省略してレイアウト崩れを防ぐ */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-price {
  font-weight: 900;
  color: #0f172a;
}
.receipt-divider {
  border-top: 2px dashed #e2e8f0;
  margin: 16px 0;
}
.receipt-total {
  display: flex;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 900;
  color: #0f172a;
}

.r-status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 13px; margin-bottom: 10px; }
.r-status.unpaid { background: #fee2e2; color: #ef4444; }

.completed-section { margin-top: 15px; margin-bottom: 15px; }
.completed-card { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; text-align: center; color: #166534; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
.completed-icon { font-size: 32px; display: block; margin-bottom: 8px; }
.completed-title { font-size: 15px; font-weight: 900; margin: 0 0 4px 0; }
.completed-date { font-size: 12px; opacity: 0.8; margin: 0; font-weight: 700; }

.payment-actions { margin-top: 15px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
.payment-actions .hint { font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 12px; }
.method-btn { width: 100%; padding: 16px; border-radius: 16px; border: none; font-weight: 900; font-size: 14px; margin-bottom: 10px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.method-btn:active { transform: scale(0.96); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.paypay { background-color: #ff0033; color: white; }
.cash { background-color: #1e293b; color: white; }
.action-btn { width: 100%; padding: 16px; border-radius: 16px; border: none; font-weight: 900; font-size: 15px; cursor: pointer; background: #e2e8f0; color: #475569; margin-top: 10px; transition: 0.2s; }
.action-btn:active { transform: scale(0.96); }

.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>