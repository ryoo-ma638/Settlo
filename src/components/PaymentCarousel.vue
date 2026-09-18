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
              <span class="detail-sub">{{ headline.receive.caption }}</span>
              <span class="detail-label"><span class="dir-arrow" aria-hidden="true">↙</span>受け取る</span>
              <div class="price-large">¥{{ headline.receive.amount.toLocaleString() }}</div>
              <p v-if="headline.receive.count" class="headline-count">あと{{ headline.receive.count }}件</p>
              <p v-for="note in headline.receive.notes" :key="note.kind" class="headline-note" :class="`headline-note--${note.kind}`">
                <span v-if="note.kind === 'review'" class="review-symbol" aria-hidden="true">!</span>{{ note.text }}
              </p>
            </div>
            <div class="recent-list">
              <p v-if="overview.receive.pending.items.length" class="detail-state">
                <span class="detail-state__label">⏳ あなたが受け取りを確認</span>
                <strong>¥{{ overview.receive.pending.amount.toLocaleString() }}</strong>
                <small>上の金額には入っていません</small>
              </p>
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
                <span class="summary-total__caption">{{ headline[side.key].caption }}</span>
                <span class="summary-total__badge"><span aria-hidden="true">{{ side.key === 'receive' ? '↙' : '↗' }}</span> {{ side.title }}</span>
                <strong class="summary-total__amount" :class="{ 'summary-total__amount--long': headline[side.key].amount >= 1000000 }">¥{{ headline[side.key].amount.toLocaleString() }}</strong>
                <span class="summary-total__count">{{ headline[side.key].count ? `あと${headline[side.key].count}件` : '0件' }}</span>
                <span v-for="note in headline[side.key].notes" :key="note.kind" class="summary-total__note" :class="`summary-total__note--${note.kind}`">
                  <span v-if="note.kind === 'review'" class="review-symbol" aria-hidden="true">!</span>{{ note.short }}
                </span>
              </button>
            </div>
            <div class="summary-ledger">
              <!-- ここは「確認待ち」だけ。上の大きい数字には入っていない分なので、
                   混ぜると同じお金が二重に見える。だから枠の中でそう書く。 -->
              <div v-if="pendingSides.length" class="ledger-pending">
                <p class="ledger-pending__title">
                  <span class="ledger-pending__icon" aria-hidden="true">⏳</span>確認待ちのお金があります
                  <small>上の金額には入っていません</small>
                </p>
                <button
                  v-for="side in pendingSides"
                  :key="side.key"
                  class="ledger-pending__row"
                  :class="`ledger-pending__row--${side.key}`"
                  :aria-label="`${side.pendingLabel}・${side.amount.toLocaleString()}円・${side.count}件`"
                  @click.stop="navigateIfActive(1, side.path)"
                >
                  <span class="ledger-pending__label">{{ side.pendingLabel }}</span>
                  <span class="ledger-pending__value">
                    <strong>¥{{ side.amount.toLocaleString() }}</strong>
                    <small>{{ side.count }}件<span v-if="side.amount === 0">・送金なし</span></small>
                  </span>
                </button>
              </div>
              <!-- 確認待ちが1件も無いときも枠は残す。
                   枠ごと消すとカードが急に縮んで落ち着かないうえ、
                   ¥0 だけが並んで悪い知らせのように見えてしまう。 -->
              <p v-else class="ledger-clear" :class="{ 'ledger-clear--todo': nextStep.todo }">
                <span class="ledger-clear__check" aria-hidden="true">{{ nextStep.todo ? '!' : '✓' }}</span>
                <span class="ledger-clear__text">
                  {{ nextStep.title }}
                  <small>{{ nextStep.desc }}</small>
                </span>
              </p>
            </div>
          </div>
  
          <div 
            class="status-card detail-card orange-bg clickable-card"
            @click="handleCardClick(2, '/payment?tab=unpaid')"
          > <div class="card-main">
              <span class="detail-sub">{{ headline.pay.caption }}</span>
              <span class="detail-label"><span class="dir-arrow" aria-hidden="true">↗</span>支払う</span>
              <div class="price-large">¥{{ headline.pay.amount.toLocaleString() }}</div>
              <p v-if="headline.pay.count" class="headline-count">あと{{ headline.pay.count }}件</p>
              <p v-for="note in headline.pay.notes" :key="note.kind" class="headline-note" :class="`headline-note--${note.kind}`">
                <span v-if="note.kind === 'review'" class="review-symbol" aria-hidden="true">!</span>{{ note.text }}
              </p>
            </div>
            <div class="recent-list">
              <p v-if="overview.pay.pending.items.length" class="detail-state">
                <span class="detail-state__label">⏳ 相手の確認待ち</span>
                <strong>¥{{ overview.pay.pending.amount.toLocaleString() }}</strong>
                <small>上の金額には入っていません</small>
              </p>
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
  import { nextStepOf, headlineOf } from '@/lib/paymentOverview';
  
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
  // 🌟 大きい数字＝いま自分が払う／受け取る必要がある額。
  //    未払い＋送金状況の確認が必要な分＋イベントでまとめて精算中の分。
  //    計算と文言は paymentOverview.js（テストできるよう切り出した）。
  const headline = computed(() => ({
    receive: headlineOf(props.overview, 'receive'),
    pay: headlineOf(props.overview, 'pay'),
  }));

  // 灰色の枠は「確認待ち」だけ。上の大きい数字とは別のお金なので混ぜない。
  const pendingSides = computed(() => sides
    .map(side => ({
      ...side,
      amount: props.overview[side.key].pending.amount,
      count: props.overview[side.key].pending.items.length,
      pendingLabel: side.key === 'receive' ? 'あなたが受け取りを確認' : '相手の確認を待っています',
    }))
    .filter(side => side.count > 0));

  // 🌟 この枠が見ているのは「確認待ち」だけで、ふつうの未払いは入っていない。
  //    それなのに「全部片付いています」と出すと、
  //    未払いが残っているのに終わったように読めてしまう。
  //    残っている金額があるときは、そう言い切らない。
  // 何を出すかの判断は paymentOverview.js にある（状態ごとにテストできるよう切り出した）
  const nextStep = computed(() => nextStepOf(props.overview));
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
  
  /* 隣のカードの見え方は、ここの2つの値だけで決まる。
     以前は カードの余白=5%(親基準) と すき間=4vw(画面基準) で単位が混ざっていたため、
     画面サイズごとに隣のカードの太さとボタンの位置関係がずれていた。
     --inset … 真ん中のカードの左右の余白
     --gap   … カード同士のすき間。隣のカードが見える幅は --inset から --gap を引いた分になる
     どちらも固定pxなので、画面幅が変わっても見え方は変わらない。 */
  .carousel-outer {
    position: relative; display: flex; align-items: center;
    --inset: 28px; --gap: 8px; --arrow: 36px;
    /* ホームの左右余白を打ち消して、隣のカードをアプリの左端・右端まで届かせる。
       これをしないと、端との間にすき間が空いて色の帯が浮いて見える。 */
    margin-inline: calc(var(--pad) * -1);
  }
  .carousel-wrapper {
    display: flex; align-items: stretch; overflow-y: hidden; overflow-x: auto;
    scroll-snap-type: x mandatory; padding: 0 var(--inset) 8px; gap: var(--gap);
    scrollbar-width: none; -webkit-overflow-scrolling: touch; width: 100%; box-sizing: border-box;
  }
  .carousel-wrapper::-webkit-scrollbar { display: none; }
  
  /* 100% は左右の余白(--inset)を除いた幅。ここから更に引くとカードが二重に細くなる */
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
  .headline-count { margin: 4px 0 0; font-size: 12px; font-weight: var(--fw-bold); opacity: 0.85; }
  .headline-note { margin: 8px auto 0; width: fit-content; max-width: 100%; padding: 5px 10px; border-radius: var(--r-pill); background: rgba(255,255,255,0.2); font-size: 11px; font-weight: var(--fw-bold); line-height: 1.4; }
  /* カードの背景が濃いので、ここでは丸印も白で描く */
  .headline-note .review-symbol { color: inherit; }
  
  .recent-list { border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; }
  .recent-title { font-size: 10px; opacity: 0.8; margin: 0 0 8px 0; text-align: left; }
  .recent-item { 
    /* 320pxで名前と金額がくっつくので、間を必ず空けて金額は縮ませない */
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    background: rgba(255,255,255,0.15); 
    padding: 8px 12px; border-radius: 10px; margin-bottom: 6px; 
    font-size: 12px; font-weight: bold;
    cursor: pointer; /* 🌟 タップ可能に */
    transition: 0.2s;
  }
  .recent-item:active { background: rgba(255,255,255,0.3); transform: scale(0.98); }
  .recent-item:last-child { margin-bottom: 0; }
  .recent-name { display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recent-amount { flex-shrink: 0; }
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
  /* まだやることが残っているときは、片付いた印と見分けがつくようにする */
  .ledger-clear--todo .ledger-clear__check { background: #ffedd5; color: #c2620a; }
  /* 確認待ちの枠。上の大きい数字とは別のお金なので、見出しでそう書く */
  .ledger-pending { width: 100%; padding: 6px 2px; }
  .ledger-pending__title { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 6px; margin: 0 0 2px; font-size: 11px; font-weight: var(--fw-bold); color: var(--c-text-sub); line-height: 1.4; }
  .ledger-pending__icon { font-size: 11px; }
  .ledger-pending__title small { font-size: 10px; font-weight: 400; opacity: 0.85; }
  .ledger-pending__row { width: 100%; min-height: 32px; padding: 4px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; background: none; border: 0; cursor: pointer; text-align: left; color: var(--c-ink); }
  .ledger-pending__row + .ledger-pending__row { border-top: 1px solid var(--c-line); }
  .ledger-pending__label { font-size: 11px; color: var(--c-text-sub); line-height: 1.4; }
  .ledger-pending__value { display: flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .ledger-pending__value strong { font-size: 14px; line-height: 1.3; }
  .ledger-pending__value small { font-size: 9px; color: var(--c-text-sub); }
  .ledger-pending__row--receive .ledger-pending__value strong { color: var(--c-receive-strong); }
  .ledger-pending__row--pay .ledger-pending__value strong { color: var(--c-pay-strong); }
  /* 大きい数字の下に足す注記。イベント分と要確認分の内訳 */
  .summary-total__count { margin-top: 3px; font-size: 11px; font-weight: var(--fw-bold); color: var(--c-text-sub); white-space: nowrap; }
  .summary-total__note { margin-top: 4px; font-size: 10px; line-height: 1.4; color: var(--c-text-sub); white-space: nowrap; }
  .summary-total__note--review { color: #826035; }
  .review-symbol { display: inline-flex; align-items: center; justify-content: center; width: 11px; height: 11px; margin-right: 3px; border: 1px solid currentColor; border-radius: 50%; font-size: 8px; color: #826035; }
  .summary-total:focus-visible, .ledger-pending__row:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 2px; border-radius: 6px; }


  .nav-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: var(--arrow); height: var(--arrow); background-color: rgba(255, 255, 255, 0.9); backdrop-filter: blur(8px); border-radius: 50%; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; z-index: 20; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); padding: 0; }
  .nav-arrow:active { transform: translateY(-50%) scale(0.85); background-color: #fff; }
  .left-arrow { left: var(--gap); }
  .right-arrow { right: var(--gap); }
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
.detail-state { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: 12px; padding-bottom: 8px; margin: 0; }
.detail-state__label { flex: 1 1 auto; }
.detail-state strong { margin-left: auto; white-space: nowrap; }
.detail-state small { flex-basis: 100%; font-size: 10px; opacity: 0.75; }
</style>
