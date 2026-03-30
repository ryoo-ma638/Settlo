<template>
  <div class="event-detail-container">
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1 class="title">イベント詳細</h1>
      <div class="spacer"></div>
    </header>

    <main class="content">
      <div class="summary-card">
        <div class="card-top">
          <h2 class="event-name">{{ eventData.name }}</h2>
          <span class="event-date">{{ eventData.date }}</span>
        </div>
        
        <div class="total-section clickable" @click="scrollToTimeline">
          <span class="label">合計金額 <span class="arrow-down">履歴を見る ↓</span></span>
          <h1 class="total-amount">¥{{ eventData.total.toLocaleString() }}</h1>
        </div>

        <div class="participants-section" @click="modals.participants = true">
          <div class="participants-header">
            <span class="label">参加者 ({{ eventData.participants.length }}名)</span>
            <span class="arrow">›</span>
          </div>
          <div class="participants-row">
            <div class="avatar-stack">
              <div 
                class="avatar" 
                v-for="(p, i) in eventData.participants.slice(0, 5)" 
                :key="i" 
                :style="{ backgroundColor: p.color, zIndex: 10 - i }"
              ></div>
              <div v-if="eventData.participants.length > 5" class="avatar-more">
                +{{ eventData.participants.length - 5 }}
              </div>
            </div>
            <button class="invite-pill-btn" @click.stop="inviteUser">
              <span class="icon">＋</span> 招待
            </button>
          </div>
        </div>
      </div>

      <div class="settlement-summary-section">
        <h3 class="section-title">精算サマリー</h3>
        
        <div class="filter-wrapper">
          <div class="ios-segmented-control">
            <button :class="{ active: sumFilterScope === 'all' }" @click="sumFilterScope = 'all'">全体</button>
            <button :class="{ active: sumFilterScope === 'me' }" @click="sumFilterScope = 'me'">自分のみ</button>
          </div>
          <div class="custom-select-wrapper">
            <select v-model="sumFilterStatus" class="ios-select">
              <option value="unpaid">未決済のみ</option>
              <option value="all">すべて</option>
              <option value="completed">精算済み</option>
            </select>
          </div>
        </div>

        <div class="summary-list">
          <div v-if="filteredSummary.length === 0" class="empty-state">該当する精算はありません</div>
          <div class="summary-card-item" v-for="sum in filteredSummary" :key="sum.id" @click="openSummaryDetail(sum)">
            <div class="flow">
              <div class="avatar-small" :style="{ backgroundColor: sum.fromColor }"></div>
              <span class="name">{{ sum.from }}</span>
              <span class="arrow-right">→</span>
              <div class="avatar-small" :style="{ backgroundColor: sum.toColor }"></div>
              <span class="name">{{ sum.to }}</span>
            </div>
            <div class="amount-right">
              <span v-if="sum.status === 'completed'" class="badge paid">完了</span>
              <div class="amount" :class="sum.isMePayer ? 'orange-text' : 'blue-text'">
                ¥{{ sum.amount.toLocaleString() }} <span class="arrow-icon">›</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="history-section" ref="timelineSection">
        <div class="section-header">
          <h3 class="section-title">立て替え履歴</h3>
          <button class="add-payment-btn" @click="modals.addPayment = true">＋ 支払いを追加</button>
        </div>

        <div class="filter-wrapper">
          <div class="ios-segmented-control">
            <button :class="{ active: histFilterScope === 'all' }" @click="histFilterScope = 'all'">全体</button>
            <button :class="{ active: histFilterScope === 'me' }" @click="histFilterScope = 'me'">自分のみ</button>
          </div>
          <div class="custom-select-wrapper auto-width">
            <select v-model="histSort" class="ios-select">
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
            </select>
          </div>
        </div>

        <div class="timeline">
          <div v-if="filteredHistory.length === 0" class="empty-state">該当する履歴はありません</div>
          
          <div class="timeline-item" v-for="history in filteredHistory" :key="history.id" @click="openHistoryDetail(history)">
            <div class="timeline-line"></div>
            <div class="timeline-dot" :style="{ backgroundColor: history.color }"></div>
            
            <div class="timeline-content">
              <div class="history-card" :class="{ 'unpaid-card': history.status === 'unpaid' }">
                <div class="history-main">
                  <div class="history-avatar" :style="{ backgroundColor: history.color }"></div>
                  <div class="history-text">
                    <span class="history-item-name">{{ history.itemName }} <span class="split-type">{{ history.splitType }}</span></span>
                    <span class="history-payer">{{ history.date }} {{ history.time }} • {{ history.payer }} が立替</span>
                  </div>
                </div>
                <div class="history-right">
                  <span class="history-price">¥{{ history.amount.toLocaleString() }}</span>
                  <button v-if="history.status === 'unpaid'" class="pay-now-btn" @click.stop="openHistoryDetail(history)">
                    決済に進む ›
                  </button>
                  <span v-else class="badge paid">精算済</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button class="end-event-btn" @click="handleEndEvent">イベントを終了する</button>
      <p class="end-hint">※相手とのやり取りは、自分の画面からのみ非表示になります。</p>
    </main>

    <Teleport to="body">
      <div v-if="modals.participants" class="modal-overlay" @click.self="modals.participants = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>参加者一覧</h3><button class="close-btn" @click="modals.participants = false">×</button></div>
          <div class="modal-list">
            <div class="list-item" v-for="p in eventData.participants" :key="p.id">
              <div class="avatar-medium" :style="{ backgroundColor: p.color }"></div>
              <span class="item-name">{{ p.name }} <span v-if="p.isMe" class="me-badge">自分</span></span>
            </div>
          </div>
        </div>
      </div>

      <ReceiptPaymentModal :isOpen="modals.historyDetail" :history="selectedHistory" @close="modals.historyDetail = false" @complete="markAsCompleted" />

      <div v-if="modals.summaryDetail && selectedSummary" class="modal-overlay" @click.self="modals.summaryDetail = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>精算の詳細</h3><button class="close-btn" @click="modals.summaryDetail = false">×</button></div>
          <div class="summary-detail-body">
            <div class="flow-large">
              <div class="avatar-large" :style="{ backgroundColor: selectedSummary.fromColor }"></div>
              <span class="arrow-large">→</span>
              <div class="avatar-large" :style="{ backgroundColor: selectedSummary.toColor }"></div>
            </div>
            <p class="s-text"><strong>{{ selectedSummary.from }}</strong> さんから<br><strong>{{ selectedSummary.to }}</strong> さんへ</p>
            <h1 class="s-amount" :class="selectedSummary.isMePayer ? 'orange-text' : 'blue-text'">¥{{ selectedSummary.amount.toLocaleString() }}</h1>
            
            <section v-if="selectedSummary.status === 'completed'" class="completed-section">
              <div class="completed-card">
                <span class="completed-icon">✅</span>
                <h3 class="completed-title">この取引は完了しています</h3>
              </div>
            </section>
            <template v-else>
  <p class="s-hint">の支払いが残っています。</p>
  <button class="action-btn main" @click="goToBatchPayment(selectedSummary)">
    {{ selectedSummary.isMePayer ? 'まとめて支払う画面へ' : 'まとめて受け取る・催促へ' }}
  </button>
          </template>
          </div>
        </div>
      </div>

      <div v-if="modals.unpaidWarning" class="modal-overlay" style="z-index: 2000;" @click.self="modals.unpaidWarning = false">
        <div class="modal-content slide-up warning-modal">
          <div class="modal-header"><h3 class="warning-title">⚠️ 未完済の取引があります</h3></div>
          <p class="warning-desc">以下の取引がまだ精算されていません。本当に終了しますか？</p>
          <div class="warning-actions">
            <button class="danger-btn" @click="forceEndEvent">終了リクエストを送る</button>
            <button class="safe-btn" @click="modals.unpaidWarning = false">戻って精算する</button>
          </div>
        </div>
      </div>

      <InviteModal :isOpen="modals.invite" eventCode="EO2Q2Z" @close="modals.invite = false" />
      <AddPaymentModal :isOpen="modals.addPayment" @close="modals.addPayment = false" @submit="addHistory" />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import AddPaymentModal from '@/components/AddPaymentModal.vue';
import ReceiptPaymentModal from '@/components/ReceiptPaymentModal.vue';
import InviteModal from '@/components/InviteModal.vue';

const router = useRouter();
const timelineSection = ref(null);
const myName = '大崎 稜馬';

const modals = ref({ participants: false, historyDetail: false, summaryDetail: false, unpaidWarning: false, addPayment: false, invite: false });

const inviteUser = () => { modals.value.invite = true; };
const selectedHistory = ref(null);
const selectedSummary = ref(null);

const eventData = ref({
  name: '鈴○サーキット', date: '2026/03/25', total: 18500,
  participants: [
    { id: 1, name: '大崎 稜馬', color: '#fca5a5', isMe: true },
    { id: 2, name: '小野木 涼平', color: '#93c5fd' },
    { id: 3, name: '天野 椋祐', color: '#86efac' },
    { id: 4, name: '中橋 楓華', color: '#fde047' },
  ],
  summary: [
    { id: 1, from: '小野木 涼平', fromColor: '#93c5fd', to: '大崎 稜馬', toColor: '#fca5a5', amount: 1500, isMePayer: false, status: 'unpaid' },
    { id: 2, from: '大崎 稜馬', fromColor: '#fca5a5', to: '天野 椋祐', toColor: '#86efac', amount: 2000, isMePayer: true, status: 'completed' }
  ],
  history: [
    { id: 1, payer: '大崎 稜馬', itemName: 'レンタカー代', splitType: '全員で割勘', amount: 8000, color: '#fca5a5', date: '3/25', time: '10:00', status: 'completed', involvesMe: true, timestamp: 1 },
    { id: 2, payer: '小野木 涼平', itemName: '高速料金', splitType: '個別会計', amount: 4500, color: '#93c5fd', date: '3/25', time: '11:30', status: 'unpaid', involvesMe: false, timestamp: 2 },
    { id: 3, payer: '天野 椋祐', itemName: '昼食代', splitType: '全員で割勘', amount: 6000, color: '#86efac', date: '3/25', time: '13:00', status: 'unpaid', involvesMe: true, timestamp: 3 }
  ]
});

const sumFilterScope = ref('all'); 
const sumFilterStatus = ref('unpaid'); 
const histFilterScope = ref('all'); 
const histSort = ref('new'); 

const filteredSummary = computed(() => {
  return eventData.value.summary.filter(s => {
    const scopeMatch = sumFilterScope.value === 'all' || (s.from === myName || s.to === myName);
    const statusMatch = sumFilterStatus.value === 'all' || s.status === sumFilterStatus.value;
    return scopeMatch && statusMatch;
  });
});

const filteredHistory = computed(() => {
  let result = eventData.value.history.filter(h => {
    return histFilterScope.value === 'all' || h.involvesMe || h.payer === myName;
  });
  return result.sort((a, b) => histSort.value === 'new' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
});

const unpaidItems = computed(() => eventData.value.history.filter(h => h.status === 'unpaid'));

const scrollToTimeline = () => timelineSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const openHistoryDetail = (h) => { selectedHistory.value = h; modals.value.historyDetail = true; };
const openSummaryDetail = (s) => { selectedSummary.value = s; modals.value.summaryDetail = true; };

const markAsCompleted = (id) => {
  const item = eventData.value.history.find(h => h.id === id);
  if(item) item.status = 'completed';
};

const addHistory = (newPayment) => {
  eventData.value.history.push({
    id: Date.now(), 
    payer: newPayment.payer, 
    itemName: newPayment.itemName, 
    splitType: newPayment.splitType,
    amount: newPayment.amount, 
    color: '#fca5a5', 
    date: newPayment.date, 
    time: newPayment.time, 
    status: 'unpaid', 
    involvesMe: true, 
    timestamp: Date.now()
  });
  eventData.value.total += newPayment.amount;
  modals.value.addPayment = false;
  setTimeout(scrollToTimeline, 300);
};


// 🌟 自分が払う側か、受け取る側かで「イベント単位のまとめ画面」へ賢く遷移させる
const goToBatchPayment = (summary) => {
  modals.value.summaryDetail = false;
  const eventId = eventData.value.id || 1; // ダミーのイベントID
  
  if (summary.isMePayer) {
    // 支払う側なら、「イベント単位で支払う」画面へ
    router.push(`/payment-detail/event-unpaid-${eventId}`);
  } else {
    // 受け取る側なら、「イベント単位で受け取る・催促する」画面へ
    router.push(`/payment-detail/event-waiting-${eventId}`);
  }
};

const handleEndEvent = () => unpaidItems.value.length > 0 ? modals.value.unpaidWarning = true : router.push('/');
const forceEndEvent = () => { modals.value.unpaidWarning = false; router.push('/'); };
</script>

<style scoped>
.event-detail-container { min-height: 100vh; background-color: #f4f7f9; display: flex; flex-direction: column; font-family: 'Helvetica Neue', Arial, sans-serif; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(0,0,0,0.03); }
.back-btn { background: none; border: none; font-size: 32px; color: #64748b; cursor: pointer; padding: 0; display: flex; align-items: center; }
.title { font-size: 17px; font-weight: 800; margin: 0; color: #1e293b; }
.content { padding: 20px; flex: 1; padding-bottom: 120px; }

.summary-card { background: white; border-radius: 28px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); margin-bottom: 32px; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.event-name { font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.5px; }
.event-date { font-size: 12px; color: #94a3b8; font-weight: 700; background: #f1f5f9; padding: 4px 10px; border-radius: 12px; }

.clickable { cursor: pointer; transition: all 0.2s ease; border-radius: 20px; padding: 12px; margin: 0 -12px; }
.clickable:active { background: #f8fafc; transform: scale(0.98); }
.total-section { text-align: center; margin-bottom: 20px; }
.label { font-size: 13px; color: #64748b; font-weight: 700; display: flex; justify-content: center; align-items: center; margin-bottom: 6px; }
.arrow-down { font-size: 10px; color: #3b82f6; background: #eff6ff; padding: 4px 10px; border-radius: 12px; margin-left: 8px; font-weight: 800; }
.total-amount { font-size: 44px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -1.5px; }

.participants-section { background: #f8fafc; padding: 16px; border-radius: 20px; cursor: pointer; transition: 0.2s; border: 1px solid #f1f5f9; }
.participants-section:active { background: #f1f5f9; }
.participants-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.participants-header .label { margin: 0; color: #475569; }
.participants-header .arrow { color: #cbd5e1; font-weight: bold; font-size: 16px; }
.participants-row { display: flex; justify-content: space-between; align-items: center; }
.avatar-stack { display: flex; align-items: center; padding-left: 8px; }
.avatar { width: 36px; height: 36px; border-radius: 50%; border: 3px solid #f8fafc; margin-left: -12px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
.avatar-more { width: 36px; height: 36px; border-radius: 50%; border: 3px solid #f8fafc; margin-left: -12px; background: #e2e8f0; color: #64748b; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; z-index: 0; }
.invite-pill-btn { background: #eff6ff; color: #3b82f6; border: none; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 800; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(59,130,246,0.15); }
.invite-pill-btn:active { transform: scale(0.95); background: #dbeafe; }

.section-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0 0 16px 0; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.add-payment-btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(59,130,246,0.25); transition: 0.2s; }
.add-payment-btn:active { transform: scale(0.95); }
.settlement-summary-section, .history-section { margin-bottom: 36px; }

.filter-wrapper { display: flex; gap: 10px; margin-bottom: 20px; }
.ios-segmented-control { display: flex; flex: 1; background: #e2e8f0; border-radius: 12px; padding: 3px; }
.ios-segmented-control button { flex: 1; padding: 8px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: #64748b; border-radius: 10px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.ios-segmented-control button.active { background: white; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.custom-select-wrapper { flex: 1; position: relative; }
.custom-select-wrapper.auto-width { flex: 0.6; }
.ios-select { width: 100%; padding: 0 12px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; font-size: 12px; font-weight: 800; color: #1e293b; outline: none; height: 100%; min-height: 36px; appearance: none; -webkit-appearance: none; cursor: pointer; }
.custom-select-wrapper::after { content: '▾'; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 10px; color: #94a3b8; pointer-events: none; }

.summary-list, .timeline { display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; font-size: 13px; color: #94a3b8; font-weight: 800; padding: 30px; background: white; border-radius: 20px; border: 2px dashed #e2e8f0; }
.summary-card-item { background: white; border-radius: 20px; padding: 18px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
.summary-card-item:active { transform: scale(0.98); border-color: #e2e8f0; }
.flow { display: flex; align-items: center; gap: 8px; }
.avatar-small { width: 24px; height: 24px; border-radius: 50%; }
.name { font-size: 14px; font-weight: 800; color: #334155; }
.arrow-right { color: #cbd5e1; font-size: 12px; font-weight: bold; }
.amount-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.amount { font-size: 18px; font-weight: 900; display: flex; align-items: center; gap: 6px; }
.blue-text { color: #3b82f6; } .orange-text { color: #f59e0b; }
.arrow-icon { font-size: 16px; color: #cbd5e1; }

.timeline { position: relative; padding-left: 12px; }
.timeline-item { position: relative; margin-bottom: 16px; cursor: pointer; display: flex; align-items: stretch; }
.timeline-line { position: absolute; left: 6px; top: 24px; bottom: -16px; width: 2px; background-color: #e2e8f0; z-index: 1; }
.timeline-item:last-child .timeline-line { display: none; }
.timeline-dot { position: absolute; left: 0; top: 20px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #f4f7f9; z-index: 2; box-shadow: 0 0 0 1px #e2e8f0; }
.timeline-content { padding-left: 28px; flex: 1; }

.history-card { background: white; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: 0.2s; border: 1px solid transparent; }
.history-card:active { transform: scale(0.98); }
.unpaid-card { border: 1px solid #fca5a5; background: #fff5f5; box-shadow: 0 4px 12px rgba(239,68,68,0.05); }

.history-main { display: flex; align-items: center; gap: 14px; }
.history-avatar { width: 36px; height: 36px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
.history-text { display: flex; flex-direction: column; gap: 2px; }
.history-item-name { font-size: 15px; font-weight: 900; color: #0f172a; }
.split-type { font-size: 10px; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 6px; border-radius: 6px; margin-left: 4px; vertical-align: middle; }
.history-payer { font-size: 11px; color: #64748b; font-weight: 700; }
.history-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.history-price { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px; }
.pay-now-btn { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 8px rgba(239,68,68,0.2); transition: 0.2s; }
.pay-now-btn:active { transform: scale(0.95); }

.badge { font-size: 10px; padding: 4px 10px; border-radius: 12px; font-weight: 800; }
.paid { background: #f1f5f9; color: #64748b; }

.end-event-btn { width: 100%; background-color: #0f172a; color: white; border: none; padding: 18px; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,0.15); transition: 0.2s; margin-bottom: 12px; }
.end-event-btn:active { transform: scale(0.96); }
.end-hint { font-size: 11px; color: #94a3b8; text-align: center; margin: 0; font-weight: 700; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
.modal-content { background: white; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; padding: 30px 25px; box-sizing: border-box; max-height: 85vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.modal-header h3 { margin: 0; font-size: 20px; color: #0f172a; font-weight: 900; }
.close-btn { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.list-item { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid #f1f5f9; }
.avatar-medium { width: 44px; height: 44px; border-radius: 50%; }
.item-name { font-size: 16px; font-weight: 800; color: #334155; display: flex; align-items: center; gap: 10px; }
.me-badge { font-size: 10px; background: #3b82f6; color: white; padding: 2px 8px; border-radius: 10px; font-weight: 800; }

.summary-detail-body { text-align: center; padding: 10px 0; }
.flow-large { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px; }
.avatar-large { width: 64px; height: 64px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.arrow-large { font-size: 24px; color: #cbd5e1; font-weight: bold; }
.s-text { font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 16px; font-weight: 700; }
.s-amount { font-size: 48px; font-weight: 900; margin: 0 0 10px; letter-spacing: -1.5px; }
.s-hint { font-size: 14px; color: #94a3b8; margin-bottom: 32px; font-weight: 700; }
.action-btn { width: 100%; padding: 18px; border-radius: 20px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
.action-btn.main { background: #3b82f6; color: white; box-shadow: 0 8px 20px rgba(59,130,246,0.25); }
.action-btn.main:active { transform: scale(0.96); }

.warning-modal { background: #fef2f2; }
.warning-title { color: #ef4444 !important; }
.warning-desc { font-size: 15px; color: #475569; font-weight: 800; margin-bottom: 24px; line-height: 1.6; }
.warning-actions { display: flex; flex-direction: column; gap: 12px; }
.danger-btn { background: #ef4444; color: white; border: none; padding: 18px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 8px 20px rgba(239,68,68,0.25); }
.safe-btn { background: white; color: #475569; border: 2px solid #cbd5e1; padding: 16px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; }

.completed-section { margin-top: 20px; margin-bottom: 20px; }
.completed-card { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; text-align: center; color: #166534; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
.completed-icon { font-size: 32px; display: block; margin-bottom: 8px; }
.completed-title { font-size: 15px; font-weight: 900; margin: 0; }

.slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>