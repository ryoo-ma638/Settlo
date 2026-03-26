<template>
  <div class="home-container">
    <section class="payment-status-carousel">
      <h2 class="section-title">お支払い状況</h2>
      <div class="carousel-wrapper" ref="carousel" @scroll="handleScroll">
        <div class="status-card detail-card blue-bg">
          <div class="full-price-view">
            <span class="detail-label">お支払い合計</span>
            <div class="price-large">¥8,300</div>
          </div>
        </div>
        <div class="status-card summary-card">
          <div class="status-box">
            <span class="badge blue">お支払い待ち</span>
            <div class="price blue-text">¥3,500</div>
            <div class="progress-bar"><div class="bar blue-bar"></div></div>
          </div>
          <div class="divider"></div>
          <div class="status-box">
            <span class="badge orange">未払い</span>
            <div class="price orange-text">¥4,800</div>
            <div class="progress-bar"><div class="bar orange-bar"></div></div>
          </div>
        </div>
        <div class="status-card detail-card orange-bg">
          <div class="full-price-view">
            <span class="detail-label">精算済み合計</span>
            <div class="price-large">¥12,000</div>
          </div>
        </div>
      </div>
      <div class="carousel-dots">
        <span class="dot" :class="{ active: currentCard === 0 }"></span>
        <span class="dot" :class="{ active: currentCard === 1 }"></span>
        <span class="dot" :class="{ active: currentCard === 2 }"></span>
      </div>
    </section>

    <section class="ongoing-events">
      <a @click="router.push('/event')" class="section-title"><h2>進行中のイベント一覧</h2></a>
      <div class="event-list-container">
        <div v-if="ongoingEvents.length === 0" class="empty-message">
          進行中のイベントはありません
        </div>
        <div v-else class="event-item" v-for="event in ongoingEvents" :key="event.id" @click="openDetail(event)">
          <div class="event-tag">{{ event.tag }}</div>
          <div class="event-info">
            <h3 class="event-name">{{ event.name }}</h3>
            <div class="member-icons">
              <span class="circle c1"></span><span class="circle c2"></span><span class="circle c3"></span>
            </div>
            <div class="event-amount">合計金額</div>
          </div>
          <div class="event-amount">{{ event.amount }}</div>

        </div>
      </ul>
    </section>

    <div v-if="selectedEvent" class="modal-overlay" @click.self="selectedEvent = null">
      <div class="detail-modal">
        <div class="modal-header">
          <span class="modal-tag">{{ selectedEvent.tag }}</span>
          <button class="close-btn" @click="selectedEvent = null">×</button>
        </div>
        
        <h2 class="modal-title">{{ selectedEvent.name }}</h2>
        
        <div class="modal-section">
          <label>メモ（目的・ルール）</label>
          <p class="modal-text">{{ selectedEvent.memo || 'メモはありません' }}</p>
        </div>

        <div class="modal-section">
          <label>招待コード</label>
          <div class="modal-code-box">
            <span class="modal-code">{{ selectedEvent.code }}</span>
            <button class="modal-copy-btn" @click="copyCode(selectedEvent.code)">コピー</button>
          </div>
        </div>

        <div class="modal-footer">
          <button class="delete-btn" @click="deleteEvent(selectedEvent.id)">
            このイベントを終了する
          </button>
          <button class="modal-main-btn" @click="selectedEvent = null">閉じる</button>
        </div>
      </div>
    </div>

    <button class="add-button" @click="$router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const currentCard = ref(1);
const carousel = ref(null);
const ongoingEvents = ref([]);
const selectedEvent = ref(null);

const openDetail = (event) => {
  selectedEvent.value = event;
};

const copyCode = (code) => {
  if (!code) return alert('コードがありません');
  navigator.clipboard.writeText(code);
  alert('コピーしました！');
};

const deleteEvent = (id) => {
  if (!confirm('このイベントを終了して削除しますか？')) return;
  const updated = ongoingEvents.value.filter(e => e.id !== id);
  ongoingEvents.value = updated;
  localStorage.setItem('settlo_events', JSON.stringify(updated));
  selectedEvent.value = null;
};

const handleScroll = () => {
  if (!carousel.value) return;
  currentCard.value = Math.round(carousel.value.scrollLeft / (carousel.value.offsetWidth * 0.85));
};

onMounted(() => {
  const saved = localStorage.getItem('settlo_events');
  if (saved) ongoingEvents.value = JSON.parse(saved);
  setTimeout(() => {
    if (carousel.value) carousel.value.scrollLeft = carousel.value.offsetWidth * 0.85;
  }, 50);
});
</script>

<style scoped>
/* 基本スタイル */
.home-container { position: relative; padding-bottom: 100px; }
.section-title { font-size: 18px; margin: 20px 20px 10px; font-weight: bold; }
.carousel-wrapper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 7.5%; gap: 10px; scrollbar-width: none; }
.status-card { flex: 0 0 85vw; background-color: white; border-radius: 20px; padding: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); scroll-snap-align: center; min-height: 140px; display: flex; align-items: center; box-sizing: border-box; }
.blue-bg { background-color: #4a86b8; color: white; justify-content: center; }
.orange-bg { background-color: #fca566; color: white; justify-content: center; }
.price-large { font-size: 32px; font-weight: bold; }
.summary-card { justify-content: space-between; }
.status-box { text-align: center; flex: 1; }
.badge { display: inline-block; color: white; padding: 2px 12px; border-radius: 10px; font-size: 11px; margin-bottom: 5px; }
.blue { background-color: #3b82f6; }
.orange { background-color: #f59e0b; }
.price { font-size: 22px; font-weight: bold; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.divider { width: 1px; height: 50px; background-color: #eee; margin: 0 10px; }
.progress-bar { width: 80%; height: 5px; background-color: #eee; border-radius: 3px; margin: 5px auto 0; }
.blue-bar { width: 60%; background-color: #3b82f6; height: 100%; border-radius: 3px; }
.orange-bar { width: 40%; background-color: #f59e0b; height: 100%; border-radius: 3px; }
.carousel-dots { display: flex; justify-content: center; gap: 6px; margin-top: 10px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background-color: #ccc; transition: 0.3s; }
.dot.active { background-color: #2169a3; width: 15px; border-radius: 10px; }

/* イベントリスト */
.ongoing-events { padding: 0 20px; }
.event-list-container { background-color: #dcdcdc; padding: 15px; border-radius: 15px; min-height: 120px; }
.empty-message { text-align: center; color: #666; padding-top: 40px; font-size: 14px; font-weight: bold; }
.event-item { background-color: white; border-radius: 15px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; }
.event-tag { background-color: #3b82f6; color: white; font-size: 10px; padding: 6px; border-radius: 8px; width: 55px; text-align: center; margin-right: 12px; }
.event-info { flex: 1; }
.event-name { font-size: 16px; margin: 0 0 4px 0; }
.circle { width: 18px; height: 18px; border-radius: 50%; display: inline-block; margin-right: 4px; }
.c1 { background-color: #fca565; } .c2 { background-color: #93c5fd; } .c3 { background-color: #86efac; }
.event-amount { font-size: 13px; font-weight: bold; }
.add-button { position: fixed; right: 20px; bottom: 100px; width: 60px; height: 60px; background-color: #2169a3; color: white; border: none; border-radius: 50%; font-size: 36px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 100; cursor: pointer; }

/* モーダル & 招待コード */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 2000; }
.detail-modal { background: white; width: 85%; border-radius: 20px; padding: 25px; box-sizing: border-box; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.modal-tag { background: #3b82f6; color: white; font-size: 12px; padding: 4px 12px; border-radius: 20px; }
.close-btn { background: none; border: none; font-size: 30px; color: #999; cursor: pointer; }
.modal-title { font-size: 24px; margin: 0; color: #333; }
.modal-section { margin-top: 20px; text-align: left; }
.modal-section label { display: block; font-size: 12px; color: #888; font-weight: bold; margin-bottom: 5px; }
.modal-text { background: #f4f7f9; padding: 12px; border-radius: 10px; margin: 0; font-size: 14px; color: #444; }
.modal-code-box { display: flex; justify-content: space-between; align-items: center; background: #1a5280; padding: 12px 18px; border-radius: 12px; }
.modal-code { color: #ffffff !important; font-family: monospace; font-size: 26px; font-weight: 800; letter-spacing: 4px; }
.modal-copy-btn { background: white; color: #2169a3; border: none; padding: 6px 14px; border-radius: 8px; font-weight: bold; }
.modal-footer { margin-top: 25px; display: flex; flex-direction: column; gap: 12px; }
.delete-btn { width: 100%; background: none; border: 1.5px solid #ff4d4f; color: #ff4d4f; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: bold; }
.modal-main-btn { width: 100%; background: #2169a3; color: white; border: none; padding: 12px; border-radius: 12px; font-size: 16px; font-weight: bold; }
</style>