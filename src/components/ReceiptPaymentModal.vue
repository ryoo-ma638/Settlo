<template>
  <Teleport to="body">
    <div v-if="isOpen && history" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content slide-up receipt-style">
        <div class="modal-header">
          <h3>取引の詳細・決済</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
        
        <div class="receipt-body">
          <div class="r-icon"><GenreIcon :type="history.category || 'その他'" /></div>
          <h2>{{ history.itemName }}</h2>
          <p class="r-date">{{ history.date }} {{ history.time }} • {{ history.splitType }}</p>
          <h1 class="r-amount">¥{{ (myAmount != null ? myAmount : history.amount).toLocaleString() }}</h1>
          <p v-if="myRole === 'payer'" class="r-role">あなたが ¥{{ history.amount.toLocaleString() }} を立替（受け取り待ち）</p>
          <p v-else-if="myRole === 'debtor'" class="r-role">あなたの負担分（全体 ¥{{ history.amount.toLocaleString() }}）</p>

          <div v-if="history.shares && history.shares.length > 0" class="shares-list">
            <div class="shares-title">負担の内訳（誰がいくら）</div>
            <div class="share-row" v-for="(s, i) in history.shares" :key="i">
              <span class="s-name">{{ s.name }}<span v-if="s.name === history.payer" class="s-tag">立替</span></span>
              <span class="s-amt">¥{{ Number(s.amount).toLocaleString() }}</span>
            </div>
          </div>

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
              <span class="completed-icon"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>
              <h3 class="completed-title">この取引は完了しています</h3>
              <p class="completed-date">支払い完了日: {{ history.date }} {{ history.time }}</p>
            </div>
          </section>

          <template v-else>
            <div class="r-status unpaid">未完済の取引です</div>
            <div class="payment-actions">
              <p class="hint">この画面から決済を完了できます</p>
              
              <PayPayAction 
                :mode="history.status === 'waiting' ? 'remind' : 'pay'" 
                :opponentUid="history.paidById || history.paidToId" 
              />
              
              <button class="method-btn cash" @click="handlePayment('cash')">{{ myRole === 'payer' ? '受け取りを記録する' : '支払った／受け取った' }}</button>
            </div>
          </template>

          <div class="edit-delete-row">
            <button class="ed-btn ed-edit" @click="$emit('edit', history)">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              編集
            </button>
            <button class="ed-btn ed-delete" @click="$emit('delete', history)">
              <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
              削除
            </button>
          </div>

          <button class="action-btn" @click="$emit('close')">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import PayPayAction from '../components/PayPayAction.vue';
import GenreIcon from '../components/GenreIcon.vue';
const props = defineProps({
  isOpen: Boolean,
  history: Object,
  myAmount: { type: Number, default: null }, // 閲覧者にとっての金額（払う/受け取る）
  myRole: { type: String, default: 'none' }   // 'payer' | 'debtor' | 'none'
});
const emit = defineEmits(['close', 'complete', 'edit', 'delete']);

const handlePayment = () => {
  // 確認は親（EventDetails）側の統一モーダルで1回だけ行う
  emit('complete', props.history.id);
};
</script>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2010; backdrop-filter: blur(2px); }
.modal-content { background: #f8fafc; width: 100%; max-width: 600px; border-radius: 30px 30px 0 0; padding: 25px; box-sizing: border-box; max-height: 90vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 900; }
.close-btn { background: #e2e8f0; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.receipt-style { text-align: center; }
.r-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 15px; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.05); background: var(--c-brand-weak, #ecfdf5); color: var(--c-brand, #059669); display: flex; align-items: center; justify-content: center; }
.r-icon :deep(svg) { width: 30px; height: 30px; }
.receipt-body h2 { margin: 0 0 5px; font-size: 22px; color: #1e293b; font-weight: 900; }
.r-date { color: #64748b; font-size: 13px; margin: 0 0 20px; font-weight: 700; }
.r-amount { font-size: 40px; margin: 0 0 6px; letter-spacing: -1px; font-weight: 900; }
.r-role { font-size: 12px; color: #64748b; font-weight: 800; margin: 0 0 15px; }

.shares-list { background: #fff; border: 1px solid #eef2f7; border-radius: 16px; padding: 14px 16px; margin: 0 0 18px; text-align: left; }
.shares-title { font-size: 11px; color: #94a3b8; font-weight: 800; margin-bottom: 10px; letter-spacing: 1px; }
.share-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px dashed #eef2f7; }
.share-row:last-child { border-bottom: none; }
.s-name { font-size: 14px; font-weight: 800; color: #334155; display: flex; align-items: center; gap: 6px; }
.s-tag { font-size: 9px; background: var(--c-brand-weak, #ecfdf5); color: var(--c-brand-strong, #059669); padding: 2px 6px; border-radius: 6px; font-weight: 800; }
.s-amt { font-size: 15px; font-weight: 900; color: #0f172a; }

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
.cash { background-color: var(--c-brand); color: white; }
.action-btn { width: 100%; padding: 16px; border-radius: 16px; border: none; font-weight: 900; font-size: 15px; cursor: pointer; background: #e2e8f0; color: #475569; margin-top: 10px; transition: 0.2s; }
.action-btn:active { transform: scale(0.96); }

/* 🌟 編集・削除 */
.edit-delete-row { display: flex; gap: 10px; margin-top: 16px; }
.ed-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 13px; border-radius: 14px; border: 1.5px solid; background: #fff; font-size: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.ed-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ed-btn:active { transform: scale(0.96); }
.ed-edit { color: #475569; border-color: #cbd5e1; }
.ed-delete { color: var(--c-danger, #ef4444); border-color: #fecaca; background: #fef2f2; }

.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>