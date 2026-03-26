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
      <h2 class="section-title">進行中のイベント</h2>
      <div class="event-list-container">
        <div v-if="ongoingEvents.length === 0" class="empty-message">
          進行中のイベントはありません
        </div>

        <div 
          v-else
          class="event-item" 
          v-for="event in ongoingEvents" 
          :key="event.id"
        >
          <div class="event-tag">{{ event.tag }}</div>
          <div class="event-info">
            <h3 class="event-name">{{ event.name }}</h3>
            <div class="member-icons">
              <span class="circle c1"></span><span class="circle c2"></span><span class="circle c3"></span>
            </div>
          </div>
          <div class="event-amount">{{ event.amount }}</div>
        </div>
      </div>
    </section>

    <button class="add-button" @click="$router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const currentCard = ref(1); // 初期位置を中央（1番目）にする
const carousel = ref(null);
const ongoingEvents = ref([]);

const handleScroll = () => {
  if (!carousel.value) return;
  const scrollLeft = carousel.value.scrollLeft;
  const width = carousel.value.offsetWidth;
  // スクロール位置から 0, 1, 2 を判定
  currentCard.value = Math.round(scrollLeft / (width * 0.85));
};

onMounted(() => {
  // 保存されたイベントを読み込み
  const saved = localStorage.getItem('settlo_events');
  if (saved) {
    ongoingEvents.value = JSON.parse(saved);
  }

  // 初期状態で中央のカードが見えるようにスクロールさせる
  if (carousel.value) {
    const cardWidth = carousel.value.offsetWidth * 0.85;
    carousel.value.scrollLeft = cardWidth;
  }
});
</script>

<style scoped>
.home-container { position: relative; padding-bottom: 100px; }
.section-title { font-size: 18px; margin: 20px 20px 10px; font-weight: bold; }

/* カルーセル設定 */
.carousel-wrapper {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 0 7%; /* 左右のカードをチラ見せするための余白 */
  gap: 10px;
  scrollbar-width: none;
}
.carousel-wrapper::-webkit-scrollbar { display: none; }

.status-card {
  flex: 0 0 85vw; /* 画面幅の85% */
  background-color: white;
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  scroll-snap-align: center;
  min-height: 140px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

/* 1枚目と3枚目のデザイン */
.blue-bg { background-color: #4a86b8; color: white; justify-content: center; }
.orange-bg { background-color: #fca566; color: white; justify-content: center; }
.price-large { font-size: 32px; font-weight: bold; }
.detail-label { font-size: 14px; display: block; text-align: center; margin-bottom: 5px; }

/* 中央カードのデザイン */
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

/* インジケーター */
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
.member-icons { display: flex; gap: 4px; }
.circle { width: 18px; height: 18px; border-radius: 50%; }
.c1 { background-color: #fca565; } .c2 { background-color: #93c5fd; } .c3 { background-color: #86efac; }
.event-amount { font-size: 13px; font-weight: bold; }

.add-button { position: fixed; right: 20px; bottom: 100px; width: 60px; height: 60px; background-color: #2169a3; color: white; border: none; border-radius: 50%; font-size: 36px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 100; cursor: pointer; }
</style>