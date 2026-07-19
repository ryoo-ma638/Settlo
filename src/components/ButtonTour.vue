<template>
  <Teleport to="body">
    <div v-if="active && currentStep" class="tour">
      <!-- 最終ステップ：スポットライト無し・画面中央にふきだし -->
      <div v-if="isFinal" class="tour__backdrop"></div>

      <!-- スポットライト：対象の穴だけ開けて周囲を暗幕で覆う -->
      <template v-else-if="hole && shields">
        <div class="tour__shield" :style="shields.top"></div>
        <div class="tour__shield" :style="shields.bottom"></div>
        <div class="tour__shield" :style="shields.left"></div>
        <div class="tour__shield" :style="shields.right"></div>
        <!-- 穴の縁の白枠リング -->
        <div class="tour__ring" :style="ringStyle"></div>
        <!-- explain のときは透明ブロッカーで対象を押せなくする -->
        <div v-if="currentStep.type === 'explain'" class="tour__blocker" :style="ringStyle"></div>
      </template>

      <!-- ふきだし（ポップ） -->
      <div class="tour__pop" :style="popStyle">
        <p class="tour__pop-title">{{ currentStep.title }}</p>
        <p class="tour__pop-desc">{{ currentStep.desc }}</p>

        <!-- action のときは「押すと進む」案内バッジ -->
        <div v-if="currentStep.type === 'action'" class="tour__badge">
          👆 光っている場所を押すと進みます
        </div>

        <div class="tour__pop-foot">
          <button class="tour__skip" @click="end">チュートリアルをスキップ</button>
          <span class="tour__count">{{ stepIndex + 1 }} / {{ STEPS.length }}</span>
          <button v-if="isFinal" class="tour__next" @click="finishHome">ホームへ戻る</button>
          <button v-else-if="currentStep.type === 'action'" class="tour__force" @click="forceAction">押せないときは次へ</button>
          <button v-else class="tour__next" @click="next">次へ</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const active = ref(false);
const stepIndex = ref(0);
const rect = ref(null); // 対象要素の位置（{top,left,width,height}）。final は null。

// 穴のまわりに付ける余白（px）
const PAD = 8;

// ツアーの手順。sel は data-tour 属性。type = explain（説明のみ）/ action（実際に押して進む）/ final（締め）。
const STEPS = [
  { type: 'explain', sel: '[data-tour="home-status"]', title: 'お支払い状況', desc: '左＝受け取る額、右＝支払う額、下＝今月の収支。カードをタップすると支払い一覧へ移動、矢印で切り替えできます。' },
  { type: 'explain', sel: '[data-tour="home-events"]', title: '進行中のイベント', desc: '旅行や飲み会ごとに立て替えをまとめる「箱」です。タップで詳細が開きます。' },
  { type: 'explain', sel: '[data-tour="avatar"]', title: 'マイページ', desc: 'プロフィール変更・お支払い履歴・ゴミ箱・アプリの使い方など、全機能の入口です。' },
  { type: 'explain', sel: '[data-tour="pending"]', title: '承認待ち', desc: 'あなたが承認する分・相手の承認待ち・承認/拒否の履歴。催促されている支払いは一番上に赤く出ます。' },
  { type: 'explain', sel: '[data-tour="chat"]', title: 'チャット', desc: '支払いの件ごとに相談できます。未読はバッジで表示、解決すると自動で片付きます。' },
  { type: 'explain', sel: '[data-tour="bell"]', title: 'お知らせ', desc: '承認依頼・催促・「これは正しいですか？」の確認がここに届きます。' },
  { type: 'explain', sel: '[data-tour="assist"]', title: 'お支払いアシスタント', desc: 'いま支払う・催促する・承認する相手を金額つきで教えてくれます。どの画面からでも開けます。' },
  { type: 'explain', sel: '[data-tour="nav-home"]', title: 'ホーム', desc: '貸し借りの全体がひと目でわかる起点です。' },
  { type: 'explain', sel: '[data-tour="nav-event"]', title: 'イベント', desc: '旅行・飲み会ごとの立て替えとメンバーを管理します。' },
  { type: 'action', sel: '[data-tour="nav-add"]', title: '＋（追加）', desc: '新しい記録はぜんぶここから。実際に押してみましょう。' },
  { type: 'explain', sel: '[data-tour="sheet-event"]', title: 'イベントを作成', desc: '旅行や飲み会の箱を作って、招待コードで仲間を集めます。' },
  { type: 'explain', sel: '[data-tour="sheet-payment"]', title: 'お支払いを追加', desc: 'イベントを選んで立て替えを記録。レシートを撮るとAIが金額や店名を自動入力します。' },
  { type: 'action', sel: '[data-tour="sheet-cancel"]', title: 'いったん閉じる', desc: '今回は「キャンセル」を押して閉じましょう。' },
  { type: 'action', sel: '[data-tour="nav-money"]', title: '支払い', desc: '次はお金の管理です。「支払い」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="pay-tabs"]', title: '3つのタブ', desc: '「お支払い待ち」＝受け取る分、「未払い」＝支払う分、「まとめて」＝相手ごとに相殺して最小回数で精算できます。' },
  { type: 'explain', sel: '[data-tour="pay-history"]', title: 'お支払い履歴', desc: '過去の支払い・受け取り・精算済みを時系列で確認できます。' },
  { type: 'action', sel: '[data-tour="nav-event"]', title: 'イベントへ', desc: '「イベント」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="event-check"]', title: '精算を確認', desc: '右上のここから、いつでも支払い画面に戻れます。' },
  { type: 'action', sel: '[data-tour="event-card"]', title: 'イベント詳細へ', desc: 'イベントカードを押すと詳細が開きます。押してみましょう。' },
  { type: 'explain', sel: '[data-tour="ev-invite"]', title: 'メンバー招待', desc: '「＋ 招待」と招待コードで仲間を追加します。承認制なので勝手に追加されません。' },
  { type: 'explain', sel: '[data-tour="ev-addpay"]', title: '支払いを追加', desc: '立て替えたらすぐ記録。割り勘は「均等・金額指定・商品ごと」の3方式です。' },
  { type: 'explain', sel: '[data-tour="ev-summary"]', title: '精算サマリー', desc: '貸し借りを自動で相殺して、最小回数の送金にまとめます。カードをタップで精算へ。' },
  { type: 'action', sel: '[data-tour="nav-friend"]', title: 'フレンドへ', desc: '「フレンド」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="friend-add"]', title: '友達を追加', desc: '名前かIDで検索して申請、相手が承認したらフレンドに。相手ごとの貸し借りも見られます。' },
  { type: 'action', sel: '[data-tour="avatar"]', title: 'マイページへ', desc: '最後に、左上の自分のアイコンを押してみましょう。' },
  { type: 'explain', sel: '[data-tour="mypage-menu"]', title: '全機能の入口', desc: 'ここから全機能へ。「アプリの使い方」で図解ガイドとこのツアーをいつでも見直せます。' },
  { type: 'final', sel: null, title: 'ツアー完了！', desc: 'これで一通りの説明はおしまいです。細かい画面ごとの説明は、マイページ→「アプリの使い方」にまとまっています。' },
];

const currentStep = computed(() => STEPS[stepIndex.value]);
const isFinal = computed(() => currentStep.value?.type === 'final');

// 対象の矩形に余白を足した「穴」
const hole = computed(() => {
  if (!rect.value) return null;
  return {
    top: rect.value.top - PAD,
    left: rect.value.left - PAD,
    width: rect.value.width + PAD * 2,
    height: rect.value.height + PAD * 2,
  };
});

// 穴の周囲を覆う4枚のシールド（上下左右）
const shields = computed(() => {
  const h = hole.value;
  if (!h) return null;
  const top = Math.max(h.top, 0);
  const left = Math.max(h.left, 0);
  const bottomY = h.top + h.height;
  const rightX = h.left + h.width;
  return {
    top: { top: '0px', left: '0px', right: '0px', height: top + 'px' },
    bottom: { top: bottomY + 'px', left: '0px', right: '0px', bottom: '0px' },
    left: { top: top + 'px', left: '0px', width: left + 'px', height: h.height + 'px' },
    right: { top: top + 'px', left: rightX + 'px', right: '0px', height: h.height + 'px' },
  };
});

// 穴の縁のリング・ブロッカーの位置
const ringStyle = computed(() => {
  const h = hole.value;
  if (!h) return {};
  return { top: h.top + 'px', left: h.left + 'px', width: h.width + 'px', height: h.height + 'px' };
});

// ふきだしの位置。対象が上半分なら下・下半分なら上に置き、必ず画面内に収める。
const popStyle = computed(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(440, vw - 32);
  const left = Math.max(16, (vw - w) / 2);

  if (isFinal.value || !hole.value) {
    return { width: w + 'px', left: left + 'px', top: '50%', transform: 'translateY(-50%)' };
  }

  const h = hole.value;
  const style = { width: w + 'px', left: left + 'px' };
  const centerY = h.top + h.height / 2;
  if (centerY < vh / 2) {
    style.top = h.top + h.height + 14 + 'px'; // 対象は上半分 → 下に出す
  } else {
    style.bottom = vh - h.top + 14 + 'px'; // 対象は下半分 → 上に出す
  }
  return style;
});

// --- 対象探し・計測 ---
let curEl = null;         // 現在の対象要素
let retryTimer = null;    // 対象が見つかるまでの再試行タイマー
let onActionClick = null; // action ステップのクリック監視

const clearRetry = () => { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } };

// 現在の対象を測り直す（resize でも呼ぶ）
const measure = () => {
  if (!curEl) return;
  const r = curEl.getBoundingClientRect();
  rect.value = { top: r.top, left: r.left, width: r.width, height: r.height };
};

// action ステップ：実際のボタンが押されたら次へ進む（実挙動はそのまま通す）
const attachAction = () => {
  detachAction();
  onActionClick = (e) => {
    const step = currentStep.value;
    if (!step || step.type !== 'action') return;
    if (e.target.closest(step.sel)) {
      detachAction();
      setTimeout(next, 350); // 画面遷移などの実挙動が終わるのを待ってから進む
    }
  };
  document.addEventListener('click', onActionClick, true); // capture 段階で拾う
};
const detachAction = () => {
  if (onActionClick) {
    document.removeEventListener('click', onActionClick, true);
    onActionClick = null;
  }
};

// 対象を探して計測（見つからなければ再試行、限界を超えたら自動でスキップ）
const locate = (attempt = 0) => {
  const step = currentStep.value;
  if (!step) return;

  if (step.type === 'final' || !step.sel) {
    curEl = null;
    rect.value = null;
    return;
  }

  const el = document.querySelector(step.sel);
  if (!el) {
    // イベント詳細は Firestore 読込で遅れるので長めに待つ（25回×150ms）
    if (attempt < 25) {
      retryTimer = setTimeout(() => locate(attempt + 1), 150);
    } else {
      advance(); // 見つからないステップは飛ばす
    }
    return;
  }

  curEl = el;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  requestAnimationFrame(() => {
    measure();
    if (currentStep.value?.type === 'action') attachAction();
  });
};

// ステップ移動
const goTo = (i) => {
  clearRetry();
  detachAction();
  if (i >= STEPS.length) { end(); return; }
  stepIndex.value = i;
  locate(0);
};
const next = () => goTo(stepIndex.value + 1);
const advance = () => goTo(stepIndex.value + 1);

// action の「押せないときは次へ」：対象を実際に押してから進む
const forceAction = () => {
  detachAction();
  if (curEl) curEl.click();
  setTimeout(next, 350);
};

// --- 開始・終了 ---
const start = async () => {
  // ツアーはホームから始める
  if (router.currentRoute.value.path !== '/') {
    await router.push('/');
  }
  active.value = true;
  stepIndex.value = 0;
  window.addEventListener('resize', measure);
  await nextTick();
  setTimeout(() => locate(0), 100);
};

const end = () => {
  clearRetry();
  detachAction();
  window.removeEventListener('resize', measure);
  active.value = false;
  curEl = null;
  rect.value = null;
  // 開いたままの「＋」選択シートがあれば閉じる
  document.querySelector('[data-tour="sheet-cancel"]')?.click();
};

const finishHome = () => {
  router.push('/');
  end();
};

onMounted(() => window.addEventListener('settlo:show-button-tour', start));
onUnmounted(() => {
  window.removeEventListener('settlo:show-button-tour', start);
  clearRetry();
  detachAction();
  window.removeEventListener('resize', measure);
});
</script>

<style scoped>
/* 全体はクリックを素通し。暗幕やふきだしだけがクリックを吸う */
.tour {
  position: fixed;
  inset: 0;
  z-index: 6000;
  pointer-events: none;
}

/* 暗幕（4枚のシールド＋最終の全面幕） */
.tour__shield,
.tour__backdrop {
  position: fixed;
  background: rgba(15, 23, 42, 0.62);
  pointer-events: auto;
}
.tour__backdrop { inset: 0; }

/* 穴の縁の白枠リング */
.tour__ring {
  position: fixed;
  border: 2px solid #fff;
  border-radius: 14px;
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.15);
}

/* explain のとき、対象を押せなくする透明ブロッカー */
.tour__blocker {
  position: fixed;
  border-radius: 14px;
  pointer-events: auto;
}

/* ふきだし */
.tour__pop {
  position: fixed;
  z-index: 6002;
  box-sizing: border-box;
  background: var(--c-surface, #fff);
  border-radius: 18px;
  padding: 16px 18px 14px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.32);
  pointer-events: auto;
}
.tour__pop-title { font-size: 15px; font-weight: 800; color: var(--c-ink, #0f172a); margin: 0 0 7px; }
.tour__pop-desc { font-size: 13px; color: var(--c-text-sub, #475569); line-height: 1.7; margin: 0; }

.tour__badge {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--c-brand, #16a34a);
  background: var(--c-brand-weak, #ecfdf5);
  border-radius: 999px;
  padding: 7px 12px;
}

.tour__pop-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
}
.tour__skip {
  background: none; border: none;
  color: var(--c-text-faint, #94a3b8);
  font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 2px;
}
.tour__count { font-size: 12px; font-weight: 700; color: var(--c-text-faint, #94a3b8); }
.tour__next {
  background: var(--c-brand, #16a34a); color: #fff;
  border: none; border-radius: 999px;
  padding: 9px 20px; font-size: 13px; font-weight: 800; cursor: pointer;
}
.tour__next:active { transform: scale(0.97); }
.tour__force {
  background: none; border: none;
  color: var(--c-text-faint, #94a3b8);
  font-size: 12px; font-weight: 700; cursor: pointer;
  text-decoration: underline; padding: 6px 2px;
}
</style>
