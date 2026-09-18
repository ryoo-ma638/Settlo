<template>
    <section class="payment-status-carousel">
      <h2 class="section-title">現在の精算状況</h2>
      <p v-if="overview.issues?.length" class="overview-warning" role="status">一部の取引を確認できないため、確認できた分を表示しています。</p>
      
      <div class="carousel-outer">
        <transition name="fade">
          <button v-show="currentCard > 0" class="nav-arrow left-arrow" @click="scrollCarousel(-1)">
            <span class="chevron left"></span>
          </button>
        </transition>
        
        <div class="carousel-wrapper" ref="carousel" @scroll="handleScroll">

          <!-- 読み込み中スケルトン（データが届くまでカードの形だけ見せる） -->
          <template v-if="loading">
            <div v-for="n in 3" :key="'sk' + n" class="status-card white-bg">
              <div class="skeleton skeleton--text" style="width:50%;height:13px;margin:0 auto 16px"></div>
              <div class="skeleton skeleton--text" style="width:62%;height:34px;margin:0 auto 20px;border-radius:10px"></div>
              <div class="skeleton" style="height:44px;border-radius:12px"></div>
            </div>
          </template>

          <template v-else>
          <div
            class="status-card detail-card blue-bg clickable-card"
            @click="handleCardClick(0, '/payment?tab=waiting')"
          > <div class="card-main">
              <span class="detail-sub">相手の支払い待ち</span>
              <span class="detail-label"><span class="dir-arrow" aria-hidden="true">↙</span>受け取る</span>
              <div class="price-large">¥{{ summary.receivableTotal.toLocaleString() }}</div>
              <p v-if="overview.receive.review.items.length" class="review-summary">確認が必要 ¥{{ overview.receive.review.amount.toLocaleString() }}・{{ overview.receive.review.items.length }}件</p>
              <p v-if="overview.receive.event.items.length" class="review-summary">イベントで精算中 ¥{{ overview.receive.event.amount.toLocaleString() }}・{{ overview.receive.event.items.length }}件</p>
            </div>
            <div class="recent-list">
              <p v-if="overview.receive.pending.items.length" class="detail-state">あなたの受取確認待ち <strong>¥{{ overview.receive.pending.amount.toLocaleString() }}</strong></p>
              <p v-if="overview.receive.review.items.length" class="detail-state">送金状況の確認が必要 <strong>¥{{ overview.receive.review.amount.toLocaleString() }}</strong></p>
              <p v-if="overview.receive.event.items.length" class="detail-state">イベントでまとめて精算中 <strong>¥{{ overview.receive.event.amount.toLocaleString() }}</strong></p>
              <p class="recent-title">相手の支払い待ち</p>
              <div
                class="recent-item"
                v-for="(item, index) in summary.receivableList.slice(0, 2)"
                :key="index"
                @click.stop="item.id ? navigateIfActive(0, '/payment-detail/waiting-' + item.id) : null"
              >
                <span class="recent-name">
                  {{ item.name }}（{{ item.itemName }}）
                  <span v-if="item.status === 'awaiting_approval'" class="recent-badge">要承認</span>
                </span>
                <span class="recent-amount">¥{{ item.amount.toLocaleString() }}</span>
              </div>
              <p v-if="summary.receivableList.length === 0" class="recent-empty">相手の支払い待ちはありません</p>
              <button
                v-if="summary.receivableList.length > 2"
                class="recent-more"
                @click.stop="navigateIfActive(0, '/payment?tab=waiting')"
              >他 {{ summary.receivableList.length - 2 }} 件をすべて見る</button>
            </div>
          </div>
  
          <div class="status-card summary-card white-bg clickable-card" @click="handleCardClick(1, null)">
            <div class="summary-totals">
              <button v-for="side in sides" :key="side.key" class="summary-total" :class="`summary-total--${side.key}`" @click.stop="navigateIfActive(1, side.path)">
                <span class="summary-total__caption">{{ side.key === 'receive' ? '相手の支払い待ち' : '未払い' }}</span>
                <span class="summary-total__badge"><span aria-hidden="true">{{ side.key === 'receive' ? '↙' : '↗' }}</span> {{ side.title }}</span>
                <strong class="summary-total__amount" :class="{ 'summary-total__amount--long': overview[side.key].unpaid.amount >= 1000000 }">¥{{ overview[side.key].unpaid.amount.toLocaleString() }}</strong>
              </button>
            </div>
            <div class="summary-ledger">
              <table v-if="statusRows.length">
                <caption class="sr-only">未払いとは別に確認が必要な精算</caption>
                <thead><tr><th scope="col"><span class="sr-only">状態</span></th><th scope="col" class="summary-ledger__receive">↙ 受け取る</th><th scope="col" class="summary-ledger__pay">↗ 支払う</th></tr></thead>
                <tbody>
                  <tr v-for="state in statusRows" :key="state">
                    <th scope="row"><span v-if="state === 'review'" class="review-symbol" aria-hidden="true">!</span>{{ STATE_LABEL[state] }}</th>
                    <td v-for="side in sides" :key="side.key">
                      <button v-if="overview[side.key][state].items.length" class="summary-ledger__value" :class="`summary-ledger__${side.key}`" :aria-label="`${side.title}・${stateAria(state, side.key)}・${overview[side.key][state].amount.toLocaleString()}円・${overview[side.key][state].items.length}件`" @click.stop="navigateIfActive(1, side.path)">
                        <strong>¥{{ overview[side.key][state].amount.toLocaleString() }}</strong>
                        <small>{{ overview[side.key][state].items.length }}件<span v-if="state === 'pending' && overview[side.key][state].amount === 0">・送金なし</span></small>
                      </button>
                      <span v-else class="summary-ledger__none" aria-label="該当なし">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <!-- 確認が要るものが1件も無いときも枠は残す。
                   枠ごと消すとカードが急に縮んで落ち着かないうえ、
                   ¥0 だけが並んで悪い知らせのように見えてしまう。 -->
              <p v-else class="ledger-clear">
                <span class="ledger-clear__check" aria-hidden="true">✓</span>
                <span class="ledger-clear__text">
                  確認が必要な精算はありません
                  <small>いまは全部片付いています</small>
                </span>
              </p>
            </div>
          </div>
  
          <div 
            class="status-card detail-card orange-bg clickable-card"
            @click="handleCardClick(2, '/payment?tab=unpaid')"
          > <div class="card-main">
              <span class="detail-sub">未払い</span>
              <span class="detail-label"><span class="dir-arrow" aria-hidden="true">↗</span>支払う</span>
              <div class="price-large">¥{{ summary.payableTotal.toLocaleString() }}</div>
              <p v-if="overview.pay.review.items.length" class="review-summary">確認が必要 ¥{{ overview.pay.review.amount.toLocaleString() }}・{{ overview.pay.review.items.length }}件</p>
              <p v-if="overview.pay.event.items.length" class="review-summary">イベントで精算中 ¥{{ overview.pay.event.amount.toLocaleString() }}・{{ overview.pay.event.items.length }}件</p>
            </div>
            <div class="recent-list">
              <p v-if="overview.pay.pending.items.length" class="detail-state">相手の受取確認待ち <strong>¥{{ overview.pay.pending.amount.toLocaleString() }}</strong></p>
              <p v-if="overview.pay.review.items.length" class="detail-state">送金状況の確認が必要 <strong>¥{{ overview.pay.review.amount.toLocaleString() }}</strong></p>
              <p v-if="overview.pay.event.items.length" class="detail-state">イベントでまとめて精算中 <strong>¥{{ overview.pay.event.amount.toLocaleString() }}</strong></p>
              <p class="recent-title">未払いのお支払い</p>
              <div
                class="recent-item"
                v-for="(item, index) in summary.payableList.slice(0, 2)"
                :key="'p'+index"
                @click.stop="item.id ? navigateIfActive(2, '/payment-detail/unpaid-' + item.id) : null"
              >
                <span class="recent-name">
                  {{ item.name }}（{{ item.itemName }}）
                  <span v-if="item.status === 'awaiting_approval'" class="recent-badge">リクエスト済み</span>
                </span>
                <span class="recent-amount">¥{{ item.amount.toLocaleString() }}</span>
              </div>
              <p v-if="summary.payableList.length === 0" class="recent-empty">未払いはありません</p>
              <button
                v-if="summary.payableList.length > 2"
                class="recent-more"
                @click.stop="navigateIfActive(2, '/payment?tab=unpaid')"
              >他 {{ summary.payableList.length - 2 }} 件をすべて見る</button>
            </div>
          </div>
          </template>

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
  import { ref, computed, onMounted, watch, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const currentCard = ref(1);
  const carousel = ref(null);
  
// PaymentCarousel.vue の props 部分
const props = defineProps({
  overview: { type: Object, required: true },
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
  },
  loading: { type: Boolean, default: false } // 初回読込中はスケルトンを出す
});

  const sides = [
    { key: 'receive', title: '受け取る', path: '/payment?tab=waiting' },
    { key: 'pay', title: '支払う', path: '/payment?tab=unpaid' },
  ];
  // 表に出す区分。イベント側で精算中の分も、金額が消えないよう1行足す。
  const STATE_LABEL = { pending: '確認待ち', review: '要確認', event: 'イベント' };
  const stateAria = (state, sideKey) => (
    state === 'review' ? '送金状況の確認が必要'
      : state === 'event' ? 'イベントでまとめて精算中'
        : sideKey === 'receive' ? 'あなたの受取確認待ち' : '相手の受取確認待ち'
  );
  const statusRows = computed(() => ['pending', 'review', 'event'].filter(state =>
    sides.some(side => props.overview[side.key][state].items.length)));
  // ------------------------------
  // スクロール計算系のロジック
  // ------------------------------
  const handleScroll = () => {
    if (!carousel.value) return;
    const scrollPos = carousel.value.scrollLeft;
    const cardWidth = carousel.value.children[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(carousel.value).columnGap) || 0;
    currentCard.value = Math.max(0, Math.min(2, Math.round(scrollPos / (cardWidth + gap))));
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
  
  const centerToMiddle = () => {
    if (carousel.value && carousel.value.children[0]) {
      const cardWidth = carousel.value.children[0].offsetWidth;
      const gap = window.innerWidth * 0.04;
      carousel.value.scrollLeft = cardWidth + gap;
    }
  };
  onMounted(() => { nextTick(() => { centerToMiddle(); }); });
  // スケルトン→実データに切り替わったら中央カードへ戻す（差し替えでスクロールがリセットされるため）
  watch(() => props.loading, (isLoading) => {
    nextTick(() => { if (!isLoading) centerToMiddle(); });
  });
  </script>
  
  <style scoped>
  /* 既存のレイアウトCSSはそのまま継承します */
  .payment-status-carousel { margin-bottom: 16px; }
  .section-title { font-size: 16px; margin: 10px 16px 10px; font-weight: var(--fw-bold); color: var(--c-ink); }
  
  /* 隣のカードをのぞかせる幅と左右ボタンの大きさは、ここで一括で決める。
     以前は のぞき幅=5%(親基準) と すき間=4vw(画面基準) が混ざっていたため、
     画面サイズごとに青とオレンジの帯の太さとボタンの位置関係がずれていた。 */
  .carousel-outer { position: relative; display: flex; align-items: center; --peek: 16px; --arrow: 36px; }
  .carousel-wrapper {
    display: flex; align-items: stretch; overflow-y: hidden; overflow-x: auto;
    scroll-snap-type: x mandatory; padding: 0 var(--peek) 8px;
    scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100%; box-sizing: border-box;
    /* すき間を左右の余白と同じ幅にすると、隣のカードの端がちょうど画面外に収まる。
       青とオレンジの帯が出ないのはこのため。カードが何枚あるかは下の点で分かる。 */
    gap: var(--peek);
  }
  .carousel-wrapper::-webkit-scrollbar { display: none; }
  
  /* 100% は左右の余白を除いた幅。ここから更に引くとカードが二重に細くなる */
  .status-card { flex: 0 0 100%; border-radius: var(--r-lg); padding: 20px; box-shadow: var(--shadow-card); scroll-snap-align: center; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; transition: transform 0.3s ease; min-height: 156px; }
  
  /* 🌟 追加：タップできることを示すカーソルとエフェクト */
  .clickable-card { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .clickable-card:active { transform: scale(0.98); }
  
  .blue-bg { background: var(--c-receive); color: #fff; }
  .orange-bg { background: var(--c-pay); color: #fff; }
  .white-bg { background: #ffffff; border: 1px solid var(--c-surface-2); }
  
  .card-main { text-align: center; margin-bottom: 15px; }
  /* 「相手の支払い待ち／未払い」は補助表記。金額の直前には向き（受け取る／支払う）を置く */
  .detail-sub { display: block; font-size: 11px; opacity: 0.8; font-weight: bold; }
  .detail-label { display: block; font-size: 14px; opacity: 1; font-weight: bold; margin-top: 2px; }
  .dir-arrow { margin-right: 3px; }
  .price-large { font-size: 38px; font-weight: 900; letter-spacing: -1px; margin-top: 5px; }
  .review-summary { margin: 10px auto 0; width: fit-content; padding: 5px 10px; border-radius: var(--r-pill); background: rgba(255,255,255,0.2); font-size: 11px; font-weight: var(--fw-bold); }
  
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
  .recent-name { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recent-badge { flex-shrink: 0; background: rgba(255,255,255,0.30); padding: 1px 7px; border-radius: 8px; font-size: 9px; font-weight: bold; }
  .recent-empty { font-size: 11px; opacity: 0.85; text-align: center; padding: 8px 0 2px; margin: 0; }
  .recent-more {
    display: block; width: 100%; text-align: center; margin-top: 8px; padding: 8px;
    background: rgba(255,255,255,0.18); border-radius: 10px;
    color: #fff; font-size: 11px; font-weight: bold; cursor: pointer; transition: 0.2s;
  }
  .recent-more:active { background: rgba(255,255,255,0.32); transform: scale(0.98); }
  
  .summary-card { padding: 20px 16px; }
  .summary-totals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; }
  .summary-total { min-width: 0; padding: 0 5px; border: 0; background: transparent; display: flex; flex-direction: column; align-items: center; cursor: pointer; color: var(--c-receive); }
  .summary-total--pay { color: var(--c-pay-strong); position: relative; }
  /* 区切り線は列の高さに合わせて伸ばす。高さを決め打ちすると金額の途中で切れる */
  .summary-total--pay::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; border-left: 1px solid var(--c-line); }
  .summary-total__caption { color: var(--c-text-sub); font-size: 10px; line-height: 1.5; white-space: nowrap; }
  .summary-total__badge { display: inline-flex; align-items: center; gap: 3px; margin-top: 6px; padding: 5px 10px; border-radius: 999px; background: var(--c-receive); color: #fff; font-size: 12px; line-height: 1.3; font-weight: var(--fw-bold); white-space: nowrap; }
  .summary-total--pay .summary-total__badge { background: var(--c-pay-strong); }
  .summary-total__amount { margin-top: 12px; font-size: clamp(24px, 7vw, 32px); line-height: 1.25; font-weight: var(--fw-black); letter-spacing: -0.04em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .summary-total__amount--long { font-size: clamp(15px, 4vw, 22px); letter-spacing: -0.04em; }
  .summary-ledger { margin-top: 20px; padding: 5px 10px; background: var(--c-surface-2); border-radius: 12px; min-height: 58px; display: flex; align-items: center; }
  .ledger-clear { display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; margin: 0; padding: 4px 2px; text-align: left; }
  .ledger-clear__check { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; background: #e3f3ea; color: #0f7a4d; font-size: 12px; font-weight: var(--fw-bold); }
  .ledger-clear__text { font-size: 12px; color: var(--c-text-sub); line-height: 1.45; }
  .ledger-clear__text small { display: block; font-size: 11px; opacity: 0.75; }
  .summary-ledger table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  .summary-ledger th { color: var(--c-text-sub); font-weight: 500; font-size: 10px; line-height: 1.4; text-align: left; }
  .summary-ledger thead th { padding: 6px 0; text-align: right; font-size: 9px; }
  .summary-ledger th:first-child { width: 28%; }
  .summary-ledger tbody tr + tr { border-top: 1px solid var(--c-line); }
  .summary-ledger td { padding: 0; text-align: right; vertical-align: middle; }
  .summary-ledger__value { width: 100%; min-height: 44px; padding: 6px 0 6px 3px; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; color: var(--c-ink); background: none; border: 0; cursor: pointer; font-variant-numeric: tabular-nums; }
  .summary-ledger__value strong { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
  .summary-ledger .summary-ledger__receive { color: var(--c-receive-strong); }
  .summary-ledger .summary-ledger__pay { color: var(--c-pay-strong); }
  .summary-ledger thead .summary-ledger__receive,
  .summary-ledger thead .summary-ledger__pay { font-weight: var(--fw-bold); }
  .summary-ledger__value small { font-size: 9px; color: var(--c-text-sub); line-height: 1.4; }
  .summary-ledger__none { color: var(--c-text-faint); font-size: 12px; }
  .review-symbol { display: inline-flex; align-items: center; justify-content: center; width: 11px; height: 11px; margin-right: 3px; border: 1px solid currentColor; border-radius: 50%; font-size: 8px; color: #826035; }
  .summary-total:focus-visible, .summary-ledger__value:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 2px; border-radius: 6px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

  .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: var(--arrow); height: var(--arrow); background-color: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); border-radius: 50%; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; z-index: 20; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); padding: 0; }
  .nav-arrow:active { transform: translateY(-50%) scale(0.85); background-color: #fff; }
  .left-arrow { left: calc(var(--peek) / 2); }
  .right-arrow { right: calc(var(--peek) / 2); }
  .chevron { display: inline-block; border-right: 3px solid var(--c-text); border-bottom: 3px solid var(--c-text); width: 10px; height: 10px; }
  .left { transform: rotate(135deg); margin-left: 4px; }
  .right { transform: rotate(-45deg); margin-right: 4px; }
  
  .fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
  .fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-50%) scale(0.5); }
  
  /* 🌟 ドットをボタン化 */
  .carousel-dots { display: flex; justify-content: center; gap: 8px; margin-top: 15px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--c-line-strong); transition: all 0.3s ease; cursor: pointer; }
  .dot:active { transform: scale(1.5); }
  .dot.active { background-color: var(--c-brand); width: 24px; border-radius: 10px; }
  </style>
<style scoped>
.overview-warning { font-size: 12px; line-height: 1.6; color: var(--c-text-sub); margin: 12px 0 0; }
.overview-warning { padding: 0 16px 12px; }
.detail-state { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding-bottom: 8px; }
</style>
