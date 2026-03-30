<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import RemindModal from '@/components/RemindModal.vue';

const router = useRouter();
const route = useRoute();

const waitingTotal = ref(3500); 
const unpaidTotal = ref(4800);  
const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);

// 催促モーダルの状態
const isRemindModalOpen = ref(false);
const openRemindModal = () => { isRemindModalOpen.value = true; };

// 🌟 イベントと明細（アイテム）の階層データ
const waitingEvents = ref([
  { 
    id: 1, name: '鈴○サーキット', date: '2026/03/25', totalAmount: 3500,
    items: [
      { id: 101, name: 'レンタカー代', amount: 2000 },
      { id: 102, name: '高速料金', amount: 1500 }
    ]
  }
]);

const unpaidEvents = ref([
  { 
    id: 2, name: 'スノボ旅行', date: '2026/03/10', totalAmount: 4800,
    items: [
      { id: 201, name: 'リフト券代', amount: 4800 }
    ]
  }
]);
</script>

<template>
  <div class="friend-detail-container">
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <div class="user-info-block">
        <div class="user-avatar" style="background-color: #ff9980;"></div>
        <h1 class="user-name">{{ $route.params.name }}</h1>
      </div>
      <button class="delete-link-btn">削除する</button>
    </header>

    <main class="scroll-content">
      <section class="total-balance-card" @click="$router.push('/combined-settlement/' + $route.params.name)">
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

      <h2 class="section-title">{{ $route.params.name }} さんとのお支払い状況</h2>

      <section class="status-section">
        <div class="status-header-row">
          <div class="status-title-group">
            <h3 class="status-title blue-text"><span class="status-icon">📥</span> お支払い待ち</h3>
            <span class="status-total blue-text">¥{{ waitingTotal.toLocaleString() }}</span>
          </div>
          <div class="batch-action-group">
            <button class="action-btn outline-blue-btn" @click="openRemindModal">すべて催促</button>
            <button class="action-btn blue-btn" @click="$router.push('/payment-detail/batch-waiting')">すべて受取</button>
          </div>
        </div>

        <div class="event-list">
          <div v-for="event in waitingEvents" :key="'w'+event.id" class="event-group-card blue-theme">
            <div class="event-summary">
              <div class="event-summary-left">
                <span class="event-date">{{ event.date }}</span>
                <div class="event-name-row">
                  <span class="event-name">{{ event.name }}</span>
                  <span class="event-total-amount">¥{{ event.totalAmount.toLocaleString() }}</span>
                </div>
              </div>
              <div class="event-summary-right">
                <div class="action-buttons">
                  <button class="action-btn outline-blue-btn" @click.stop="openRemindModal">催促</button>
                  <button class="action-btn blue-btn" @click="$router.push('/payment-detail/event-waiting-' + event.id)">イベント受取</button>
                </div>
              </div>
            </div>
            
            <div class="item-list-container">
              <div v-for="item in event.items" :key="'wi'+item.id" class="single-item-row">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-right">
                  <span class="item-amount">¥{{ item.amount.toLocaleString() }}</span>
                  <button class="mini-btn blue-mini" @click="$router.push('/payment-detail/waiting-' + item.id)">個別受取</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <section class="status-section">
        <div class="status-header-row">
          <div class="status-title-group">
            <h3 class="status-title orange-text"><span class="status-icon">📤</span> 未払い</h3>
            <span class="status-total orange-text">¥{{ unpaidTotal.toLocaleString() }}</span>
          </div>
          <div class="batch-action-group">
            <button class="action-btn green-btn pay-all-btn" @click="$router.push('/payment-detail/all')">すべて支払う</button>
          </div>
        </div>

        <div class="event-list">
          <div v-for="event in unpaidEvents" :key="'u'+event.id" class="event-group-card orange-theme">
            <div class="event-summary">
              <div class="event-summary-left">
                <span class="event-date">{{ event.date }}</span>
                <div class="event-name-row">
                  <span class="event-name">{{ event.name }}</span>
                  <span class="event-total-amount">¥{{ event.totalAmount.toLocaleString() }}</span>
                </div>
              </div>
              <div class="event-summary-right">
                <button class="action-btn green-btn" @click="$router.push('/payment-detail/event-unpaid-' + event.id)">イベント支払</button>
              </div>
            </div>
            
            <div class="item-list-container">
              <div v-for="item in event.items" :key="'ui'+item.id" class="single-item-row">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-right">
                  <span class="item-amount">¥{{ item.amount.toLocaleString() }}</span>
                  <button class="mini-btn green-mini" @click="$router.push('/payment-detail/unpaid-' + item.id)">個別支払</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="history-section">
        <button class="history-toggle-btn">{{ $route.params.name }} さんとの過去の履歴</button>
        <div class="history-list">
          <div v-for="n in 5" :key="'h'+n" class="history-card">
            <span class="history-event-name">イベント名{{n}}</span>
            <div class="history-flow"><div class="avatar dummy-me"></div><span class="arrow">→</span><div class="avatar dummy-friend"></div></div>
            <span class="history-amount">¥0</span>
            <span class="check-icon">✅</span>
          </div>
        </div>
      </section>
    </main>

    <RemindModal :isOpen="isRemindModalOpen" @close="isRemindModalOpen = false" />
  </div>
</template>

<style scoped>
/* 基本スタイル */
.friend-detail-container { height: calc(100vh - 85px); background-color: #f4f7f9; display: flex; flex-direction: column; font-family: 'Helvetica Neue', Arial, sans-serif; }
.detail-header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: rgba(255,255,255,0.85); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(0,0,0,0.05); }
.scroll-content { flex: 1; overflow-y: auto; padding: 20px; scrollbar-width: none; padding-bottom: 50px; }
.scroll-content::-webkit-scrollbar { display: none; }
.back-btn { background: none; border: none; font-size: 32px; color: #64748b; cursor: pointer; }
.user-info-block { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.user-name { font-size: 18px; font-weight: 900; margin: 0; color: #1e293b; }
.delete-link-btn { background: none; border: none; color: #ef4444; font-size: 13px; font-weight: bold; }

/* トータル収支カード */
.total-balance-card { background-color: #fff; border-radius: 24px; padding: 24px; margin-bottom: 25px; box-shadow: 0 8px 20px rgba(0,0,0,0.03); cursor: pointer; text-align: center; transition: 0.2s; }
.total-balance-card:active { transform: scale(0.98); }
.balance-label { font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; }
.balance-main { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 16px; }
.balance-amount { font-size: 34px; font-weight: 900; margin: 0; letter-spacing: -1px; }
.arrow-icon { font-size: 24px; color: #cbd5e1; }
.balance-sub-info { font-size: 11px; font-weight: 700; color: #64748b; display: flex; justify-content: center; gap: 15px; background: #f8fafc; padding: 10px; border-radius: 12px; }
.sub-item { display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.blue-dot { background-color: #3b82f6; }
.orange-dot { background-color: #f59e0b; }

.section-title { font-size: 16px; font-weight: 900; margin-bottom: 20px; color: #1e293b; }

/* 🌟 改修：大見出しの行（金額は左、ボタンは右） */
.status-section { margin-bottom: 35px; }
.status-header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
.status-title-group { display: flex; align-items: center; gap: 12px; }
.status-title { font-size: 24px; font-weight: 900; margin: 0; display: flex; align-items: center; gap: 6px; }
.status-icon { font-size: 18px; }
.status-total { font-size: 30px; font-weight: 900; letter-spacing: -0.5px; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.batch-action-group { display: flex; gap: 8px; }

/* 🌟 階層化されたイベントカード */
.event-list { display: flex; flex-direction: column; gap: 16px; }
.event-group-card { border-radius: 20px; background-color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.03); overflow: hidden; }
.blue-theme { border: 1px solid #e0f2fe; }
.orange-theme { border: 1px solid #ffedd5; }

/* 🌟 イベントのサマリー部分（見出しと同じく、金額は左・ボタンは右） */
.event-summary { padding: 16px; background-color: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; flex-wrap: wrap; gap: 10px; }
.blue-theme .event-summary { background-color: #f0f9ff; border-bottom-color: #bae6fd; }
.orange-theme .event-summary { background-color: #fff7ed; border-bottom-color: #fed7aa; }

.event-summary-left { display: flex; flex-direction: column; gap: 2px; }
.event-date { font-size: 11px; color: #64748b; font-weight: 800; }
.event-name-row { display: flex; align-items: baseline; gap: 12px; }
.event-name { font-size: 16px; font-weight: 900; color: #1e293b; }
.event-total-amount { font-size: 18px; font-weight: 900; color: #1e293b; letter-spacing: -0.5px; }
.event-summary-right { display: flex; align-items: center; }

/* 個別アイテムのリスト部分 */
.item-list-container { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.single-item-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
.single-item-row:last-child { border-bottom: none; }
.item-name { font-size: 13px; font-weight: 800; color: #475569; }
.item-right { display: flex; align-items: center; gap: 10px; }
.item-amount { font-size: 14px; font-weight: 900; color: #334155; }

/* ボタン類 */
.action-buttons { display: flex; gap: 6px; }
.action-btn { padding: 8px 14px; border-radius: 12px; border: none; font-size: 12px; font-weight: 900; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.action-btn:active { transform: scale(0.95); }
.blue-btn { background-color: #3b82f6; color: white; }
.outline-blue-btn { background-color: white; color: #3b82f6; border: 1.5px solid #3b82f6; box-shadow: none; }
.green-btn { background-color: #22c55e; color: white; }

/* 個別決済用の小さなボタン */
.mini-btn { padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer; border: none; transition: 0.2s; }
.mini-btn:active { transform: scale(0.95); }
.blue-mini { background-color: #eff6ff; color: #3b82f6; }
.green-mini { background-color: #f0fdf4; color: #16a34a; }

/* 履歴セクション */
.history-toggle-btn { width: 100%; padding: 16px; background-color: #e2e8f0; color: #475569; border: none; border-radius: 16px; font-size: 14px; font-weight: 900; margin-bottom: 15px; cursor: pointer; transition: 0.2s; }
.history-toggle-btn:active { transform: scale(0.98); }
.history-card { background-color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 20px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
.history-event-name { font-size: 14px; font-weight: 900; color: #1e293b; }
.history-flow { display: flex; align-items: center; gap: 8px; }
.avatar { width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.dummy-me { background-color: #fca5a5; }
.dummy-friend { background-color: #93c5fd; }
.history-amount { font-size: 15px; font-weight: 900; color: #1e293b; }
.check-icon { font-size: 14px; }
</style>