<template>
    <section class="payment-status-carousel">
      <h2 class="section-title">お支払い状況</h2>
      
      <div class="carousel-outer">
        <transition name="fade">
          <button v-show="currentCard > 0" class="nav-arrow left-arrow" @click="scrollCarousel(-1)">
            <span class="chevron left"></span>
          </button>
        </transition>
        
        <div class="carousel-wrapper" ref="carousel" @scroll="handleScroll">
          
          <div 
            class="status-card detail-card blue-bg clickable-card"
            @click="handleCardClick(0, '/payment?tab=waiting')" 
          > <div class="card-main">
              <span class="detail-label">お支払い待ち（受け取る）</span>
              <div class="price-large">¥{{ summary.receivableTotal.toLocaleString() }}</div>
            </div>
            <div class="recent-list">
              <p class="recent-title">直近の未受け取り</p>
              <div 
                class="recent-item" 
                v-for="(item, index) in summary.receivableList" 
                :key="index"
                @click.stop="item.id ? navigateIfActive(0, '/payment-detail/waiting-' + item.id) : null"
              >
                <span class="recent-name">{{ item.name }}（{{ item.itemName }}）</span>
                <span class="recent-amount">¥{{ item.amount.toLocaleString() }}</span>
              </div>
            </div>
          </div>
  
          <div class="status-card summary-card white-bg clickable-card" @click="handleCardClick(1, null)">
            <div class="summary-top">
              <div class="status-box" @click.stop="navigateIfActive(1, '/payment?tab=waiting')">
                <span class="badge blue">お支払い待ち</span>
                <div class="price blue-text">¥{{ summary.receivableTotal.toLocaleString() }}</div>
                <div class="progress-bar">
                  <div class="bar blue-bar" :style="{ width: summary.receivableTotal > 0 ? '100%' : '0%' }"></div>
                </div>
              </div>
              <div class="divider"></div>
              <div class="status-box" @click.stop="navigateIfActive(1, '/payment?tab=unpaid')">
                <span class="badge orange">未払い</span>
                <div class="price orange-text">¥{{ summary.payableTotal.toLocaleString() }}</div>
                <div class="progress-bar">
                  <div class="bar orange-bar" :style="{ width: summary.payableTotal > 0 ? '100%' : '0%' }"></div>
                </div>
              </div>
            </div>
            <div class="monthly-balance">
              今月の収支総額 <span class="balance-number">{{ monthlyBalance }}</span>
            </div>
          </div>
  
          <div 
            class="status-card detail-card orange-bg clickable-card"
            @click="handleCardClick(2, '/payment?tab=unpaid')"
          > <div class="card-main">
              <span class="detail-label">未払い（支払う）</span>
              <div class="price-large">¥{{ summary.payableTotal.toLocaleString() }}</div>
            </div>
            <div class="recent-list">
              <p class="recent-title">直近のお支払い</p>
              <div 
                class="recent-item" 
                v-for="(item, index) in summary.payableList.slice(0, 2)" 
              :key="'p'+index"
              >
                <span class="recent-name">{{ item.name }}（{{ item.itemName }}）</span>
                <span class="recent-amount">¥{{ item.amount.toLocaleString() }}</span>
              </div>
            </div>
          </div>
  
        </div>
  
        <transition name="fade">
          <button v-show="currentCard < 2" class="nav-arrow right-arrow" @click="scrollCarousel(1)">
            <span class="chevron right"></span>
          </button>
        </transition>
      </div>
  
      <div class="carousel-dots">
        <span v-for="n in 3" :key="n" class="dot" :class="{ active: currentCard === n-1 }" @click="scrollToCard(n-1)"></span>
      </div>
    </section>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { computed } from 'vue'; // 合計や収支を計算するために追加
  
  const router = useRouter();
  const currentCard = ref(1);
  const carousel = ref(null);
  
// PaymentCarousel.vue の props 部分
const props = defineProps({
  summary: {
    type: Object,
    required: true,
    // 🌟 初期値をしっかり入れることで、データが届く前の「真っ白」を防ぎます
    default: () => ({
      receivableTotal: 0,
      payableTotal: 0,
      receivableList: [],
      payableList: []
    })
  }
});

  // 🌟 データにIDを追加し、個別ページへ飛べるように修正
  const recentReceiving = ref([
    /*{ id: 1, name: '天野 椋祐 (カフェ代)', amount: 800 },
    { id: 2, name: '中橋 楓華 (ランチ代)', amount: 1200 }*/
  ]);
  const recentPaying = ref([
    /*{ id: 1, name: '小野木 涼平 (レンタカー)', amount: 2000 },
    { id: 2, name: '大崎 稜馬 (飲み会代)', amount: 6300 }*/
  ]);
  const monthlyBalance = computed(() => {
  const balance = props.summary.receivableTotal - props.summary.payableTotal;
  const sign = balance >= 0 ? '+' : '-';
  return `${sign} ¥ ${Math.abs(balance).toLocaleString()}`;
});
  
  // ------------------------------
  // スクロール計算系のロジック
  // ------------------------------
  const handleScroll = () => {
    if (!carousel.value) return;
    const scrollPos = carousel.value.scrollLeft;
    const cardWidth = carousel.value.children[0].offsetWidth;
    currentCard.value = Math.round(scrollPos / cardWidth);
  };
  
  // 矢印用：現在の位置から +1 or -1 動かす
  const scrollCarousel = (direction) => {
    if (!carousel.value) return;
    const cardWidth = carousel.value.children[0].offsetWidth;
    const gap = window.innerWidth * 0.04;
    carousel.value.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
  };
  
  // 指定したカード番号（0, 1, 2）の場所まで一気にスクロールする
  const scrollToCard = (index) => {
    if (!carousel.value) return;
    const cardWidth = carousel.value.children[0].offsetWidth;
    const gap = window.innerWidth * 0.04;
    carousel.value.scrollTo({ left: index * (cardWidth + gap), behavior: 'smooth' });
  };
  
  // ------------------------------
  // クリック・タップ時の画面遷移ロジック
  // ------------------------------
  
  // カード全体がクリックされた時
  const handleCardClick = (index, path) => {
    if (currentCard.value !== index) {
      // 🌟 中央にないカードをタップしたら、まずはそのカードを中央にスワイプする
      scrollToCard(index);
    } else if (path) {
      // 🌟 既に中央にあるカードをタップしたら、指定のページへ遷移する
      router.push(path);
    }
  };
  
  // カード内の特定のボタンや項目がクリックされた時
  const navigateIfActive = (index, path) => {
    if (currentCard.value !== index) {
      // 中央にない場合は誤操作を防ぐため、スワイプだけ行う
      scrollToCard(index);
    } else {
      router.push(path);
    }
  };
  
  onMounted(() => {
    setTimeout(() => {
      if (carousel.value) {
        const cardWidth = carousel.value.children[0].offsetWidth;
        const gap = window.innerWidth * 0.04;
        carousel.value.scrollLeft = cardWidth + gap;
      }
    }, 100);
  });
  </script>
  
  <style scoped>
  /* 既存のレイアウトCSSはそのまま継承します */
  .payment-status-carousel { margin-bottom: 30px; }
  .section-title { font-size: 18px; margin: 20px 20px 15px; font-weight: bold; color: #1e293b; }
  
  .carousel-outer { position: relative; display: flex; align-items: center; }
  .carousel-wrapper { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 5%; gap: 4vw; scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100%; box-sizing: border-box; }
  .carousel-wrapper::-webkit-scrollbar { display: none; }
  
  .status-card { flex: 0 0 90%; border-radius: 24px; padding: 24px; box-shadow: 0 8px 20px rgba(0,0,0,0.06); scroll-snap-align: center; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; transition: transform 0.3s ease; min-height: 180px; }
  
  /* 🌟 追加：タップできることを示すカーソルとエフェクト */
  .clickable-card { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .clickable-card:active { transform: scale(0.98); }
  
  .blue-bg { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
  .orange-bg { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
  .white-bg { background: #ffffff; border: 1px solid #f1f5f9; }
  
  .card-main { text-align: center; margin-bottom: 15px; }
  .detail-label { font-size: 12px; opacity: 0.9; font-weight: bold; }
  .price-large { font-size: 38px; font-weight: 900; letter-spacing: -1px; margin-top: 5px; }
  
  .recent-list { border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; }
  .recent-title { font-size: 10px; opacity: 0.8; margin: 0 0 8px 0; text-align: left; }
  .recent-item { 
    display: flex; justify-content: space-between; align-items: center; 
    background: rgba(255,255,255,0.15); 
    padding: 8px 12px; border-radius: 10px; margin-bottom: 6px; 
    font-size: 12px; font-weight: bold;
    cursor: pointer; /* 🌟 タップ可能に */
    transition: 0.2s;
  }
  .recent-item:active { background: rgba(255,255,255,0.3); transform: scale(0.98); }
  .recent-item:last-child { margin-bottom: 0; }
  
  .summary-top { display: flex; justify-content: space-between; width: 100%; }
  .status-box { text-align: center; flex: 1; cursor: pointer; transition: 0.2s; border-radius: 12px; padding: 8px 0; }
  .status-box:active { background: #f8fafc; transform: scale(0.95); } /* 🌟 押した時のフィードバック */
  .badge { display: inline-block; color: white; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-bottom: 8px; }
  .blue { background-color: #3b82f6; }
  .orange { background-color: #f59e0b; }
  .price { font-size: 24px; font-weight: bold; }
  .blue-text { color: #3b82f6; }
  .orange-text { color: #f59e0b; }
  .divider { width: 1px; height: 60px; background-color: #f1f5f9; margin: 0 15px; }
  .progress-bar { width: 85%; height: 6px; background-color: #f1f5f9; border-radius: 10px; margin: 8px auto 0; overflow: hidden; }
  .bar { height: 100%; border-radius: 10px; }
  .blue-bar { background-color: #3b82f6; transition: width 0.3s ease; }
  .orange-bar { background-color: #f59e0b; transition: width 0.3s ease; }
  
  .monthly-balance { margin-top: 20px; text-align: center; font-size: 13px; font-weight: bold; color: #94a3b8; background: #f8fafc; padding: 10px; border-radius: 12px; }
  .balance-number { font-size: 18px; color: #10b981; margin-left: 8px; }
  
  .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; background-color: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); border-radius: 50%; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; z-index: 20; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); padding: 0; }
  .nav-arrow:active { transform: translateY(-50%) scale(0.85); background-color: #fff; }
  .left-arrow { left: 8px; }
  .right-arrow { right: 8px; }
  .chevron { display: inline-block; border-right: 3px solid #1e293b; border-bottom: 3px solid #1e293b; width: 10px; height: 10px; }
  .left { transform: rotate(135deg); margin-left: 4px; }
  .right { transform: rotate(-45deg); margin-right: 4px; }
  
  .fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
  .fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-50%) scale(0.5); }
  
  /* 🌟 ドットをボタン化 */
  .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 15px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background-color: #cbd5e1; transition: all 0.3s ease; cursor: pointer; }
  .dot:active { transform: scale(1.5); }
  .dot.active { background-color: #2169a3; width: 24px; border-radius: 10px; }
  </style>