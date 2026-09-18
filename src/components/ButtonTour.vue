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
      <div ref="popEl" class="tour__pop" :style="popStyle">
        <p class="tour__pop-title">{{ currentStep.title }}</p>
        <p class="tour__pop-desc">{{ currentStep.desc }}</p>

        <!-- action のときは「押すと進む」案内バッジ -->
        <div v-if="currentStep.type === 'action'" class="tour__badge">
          👆 光っている場所を押すと進みます
        </div>

        <div class="tour__pop-foot">
          <span class="tour__left">
            <button class="tour__skip" @click="end">スキップ</button>
            <button v-if="stepIndex > 0" class="tour__back" :disabled="goingBack" @click="back">戻る</button>
          </span>
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
const goingBack = ref(false);
const stepPaths = []; // ステップ番号 → そのとき見ていた画面のパス
const rect = ref(null); // 対象要素の位置（{top,left,width,height}）。final は null。

// 穴のまわりに付ける余白（px）
const PAD = 8;

// ツアーの手順。sel は data-tour 属性。type = explain（説明のみ）/ action（実際に押して進む）/ final（締め）。
const STEPS = [
  // --- ホーム ---
  { type: 'explain', sel: '[data-tour="home-status"]', title: '現在の精算状況', desc: '大きい数字は「いま受け取る額」と「いま払う額」。すぐ下に残りの件数が出ます。灰色の枠は相手の返事を待っている分で、上の金額には入っていません。矢印で3枚のカードを切り替えられます。' },
  { type: 'explain', sel: '[data-tour="home-events"]', title: '進行中のイベント', desc: '旅行や飲み会ごとに立て替えをまとめる「箱」です。タップで詳細が開きます。' },

  // --- 画面の上（どの画面からでも使える） ---
  { type: 'explain', sel: '[data-tour="avatar"]', title: 'マイページ', desc: '左上の自分のアイコン。全機能の入口です。あとでここも見て回ります。' },
  { type: 'explain', sel: '[data-tour="pending"]', title: '承認待ち', desc: 'あなたが承認する分・相手の承認待ち・承認や拒否の履歴。催促されている支払いは一番上に赤く出ます。' },
  { type: 'explain', sel: '[data-tour="chat"]', title: '相談', desc: '支払いの件ごとに相談できます。返信に困ったら「AIと返信を考える」から、AIが会話を読んで文案を3つ出します。未読はバッジで表示、解決すると自動で片付きます。' },
  { type: 'explain', sel: '[data-tour="bell"]', title: 'お知らせ', desc: '承認依頼・催促・「これは正しいですか？」の確認がここに届きます。読み終わった分は「過去のお知らせ」へ移り、そこから片付けられます。答えるものは答えるまで残ります。' },
  { type: 'explain', sel: '[data-tour="assist"]', title: 'お支払いアシスタント', desc: 'いま支払う・催促する・承認する相手を金額つきで教えてくれます。どの画面からでも開けます。' },

  // --- 下のナビと「＋」 ---
  { type: 'explain', sel: '[data-tour="nav-home"]', title: 'ホーム', desc: '貸し借りの全体がひと目でわかる起点です。' },
  { type: 'explain', sel: '[data-tour="nav-event"]', title: 'イベント', desc: '旅行・飲み会ごとの立て替えとメンバーを管理します。' },
  { type: 'action', sel: '[data-tour="nav-add"]', title: '＋（追加）', desc: '新しい記録はぜんぶここから。実際に押してみましょう。' },
  { type: 'explain', sel: '[data-tour="sheet-event"]', title: 'イベントを作成', desc: '旅行や飲み会の箱を作って、招待コードで仲間を集めます。' },
  { type: 'explain', sel: '[data-tour="sheet-payment"]', title: 'お支払いを追加', desc: 'イベントを選んで立て替えを記録。レシートを撮るとAIが店名・金額・消費税まで自動入力します。1回に5枚までまとめて読み取れます。' },
  { type: 'explain', sel: '[data-tour="sheet-friend-split"]', title: 'フレンドと割り勘', desc: 'いつものメンバーで軽く出し合うときは、イベントを作らずに1件だけ記録できます。相手を選んで、品名・金額・立て替えた人・割り方を入れるだけです。' },
  { type: 'action', sel: '[data-tour="sheet-cancel"]', title: 'いったん閉じる', desc: '今回は「キャンセル」を押して閉じましょう。' },

  // --- 支払い画面 ---
  { type: 'action', sel: '[data-tour="nav-money"]', title: '支払い', desc: '次はお金の管理です。「支払い」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="pay-tabs"]', title: '3つのタブ', desc: '「お支払い待ち」＝受け取る分、「未払い」＝支払う分、「まとめて」＝相殺してまとめる分。上の大きい数字はホームのカードと同じ作り方です。' },
  { type: 'explain', sel: '[data-tour="pay-settle"]', title: '「まとめて」タブ', desc: '相手ごとに、全部のイベントをまたいで貸し借りを相殺します。実際にやり取りする金額と回数がここで決まります。イベントの中で全員分をまとめる精算は、イベント画面から始めます。' },
  { type: 'explain', sel: '[data-tour="pay-history"]', title: 'お支払い履歴', desc: '過去の支払い・受け取り・精算済みを時系列で確認できます。' },

  // --- イベント ---
  { type: 'action', sel: '[data-tour="nav-event"]', title: 'イベントへ', desc: '「イベント」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="event-check"]', title: '精算を確認', desc: '右上のここから、いつでも支払い画面に戻れます。' },
  { type: 'action', sel: '[data-tour="event-card"]', title: 'イベント詳細へ', desc: 'イベントカードを押すと詳細が開きます。押してみましょう。' },
  { type: 'explain', sel: '[data-tour="ev-summary"]', title: 'まとめて精算', desc: '参加者全員の貸し借りを一度にまとめて、誰が誰へいくら送ればいいかを出します。送金の回数がいちばん少なくなる組み合わせを選びます。カードをタップで精算へ。' },
  { type: 'explain', sel: '[data-tour="ev-addpay"]', title: '支払いを追加', desc: '立て替えたらすぐ記録。割り勘は「全員で均等・金額を指定・商品ごと」の3通りです。' },
  { type: 'explain', sel: '[data-tour="ev-invite"]', title: 'メンバー招待', desc: '「＋ 招待」と招待コードで仲間を追加します。はじめはコードを知っていれば誰でも入れます。「承認制にする」を選ぶと、リーダーが承認するまで参加できません。' },
  { type: 'explain', sel: '[data-tour="ev-exit"]', optional: true, title: 'イベントから退出', desc: '未精算が残っていても抜けられます。お金の記録は支払い画面に残り、抜けたあとに新しい支払いを追加されることはありません。' },
  { type: 'explain', sel: '[data-tour="ev-end"]', optional: true, title: 'イベントを終了する', desc: '精算が全部済んだら終了できます。1人が終えても、ほかの人の画面はそのままです。「あなたも終了しますか？」のお知らせが届き、全員が終えたときにイベント全体が終わります。' },
  { type: 'explain', sel: '[data-tour="ev-delete"]', optional: true, title: 'イベントを削除する', desc: '自分の画面から見えなくするだけで、記録は消えません。イベント一覧の「非表示にしたイベント」からいつでも戻せます。' },

  // --- フレンド ---
  { type: 'action', sel: '[data-tour="nav-friend"]', title: 'フレンドへ', desc: '「フレンド」を押してみましょう。' },
  { type: 'explain', sel: '[data-tour="friend-add"]', title: 'フレンドを追加', desc: '名前かIDで検索して申請、相手が承認したらフレンドに。届いた申請は「確認」から承認します。' },
  { type: 'action', sel: '[data-tour="friend-row"]', optional: true, title: 'フレンド詳細へ', desc: 'フレンドの行を押すと、その人との貸し借りだけをまとめて見られます。押してみましょう。' },
  { type: 'explain', sel: '[data-tour="fd-combined"]', optional: true, title: 'その人とまとめて精算', desc: '受け取る分と支払う分を選んで、差し引いた金額で一度に精算できます。' },
  { type: 'explain', sel: '[data-tour="fd-split"]', optional: true, title: 'この人と割り勘を記録する', desc: 'イベントを作らずに、この人との立て替えを1件だけ記録できます。' },
  { type: 'explain', sel: '[data-tour="fd-chats"]', optional: true, title: 'この人との会話を見る', desc: 'その相手とのやり取りだけを集めて見られます。' },

  // --- マイページ（全機能の入口） ---
  { type: 'action', sel: '[data-tour="avatar"]', title: 'マイページへ', desc: '最後に、左上の自分のアイコンを押してみましょう。' },
  { type: 'explain', sel: '[data-tour="mp-profile"]', title: 'プロフィールを変更', desc: '表示名とアイコンを変えられます。あなたのIDは、フレンド申請を受けるときに使います。' },
  { type: 'explain', sel: '[data-tour="mp-notify"]', title: '通知設定', desc: 'スマホへの通知を受け取るかどうかを切り替えます。' },
  { type: 'explain', sel: '[data-tour="mp-friend"]', title: 'フレンド', desc: '下のナビと同じフレンド一覧へ。ここからでも開けます。' },
  { type: 'explain', sel: '[data-tour="mp-history"]', title: 'お支払い履歴', desc: '精算が終わったものも含めて、全部の記録を時系列で見返せます。' },
  { type: 'explain', sel: '[data-tour="mp-approvals"]', title: '承認待ち', desc: '画面の上のアイコンと同じ場所です。承認する分・待っている分がまとまっています。' },
  { type: 'explain', sel: '[data-tour="mp-chats"]', title: '相談', desc: '支払いごとの会話の一覧です。相手ごとにまとめて見ることもできます。' },
  { type: 'explain', sel: '[data-tour="mp-trash"]', title: '元に戻す', desc: '消した立て替えや、非表示にしたイベント、片付けたお知らせを戻せます。7日たつと自動で消えます。' },
  { type: 'explain', sel: '[data-tour="mp-help"]', title: 'ヘルプ・使い方', desc: '図解の使い方ガイドと、このツアーをいつでも見直せます。画面ごとの説明もここにあります。' },

  { type: 'final', sel: null, title: 'ツアー完了！', desc: 'これで全部の画面をひと通り見ました。細かい説明は、マイページ→「ヘルプ・使い方」にまとまっています。' },
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

// 🌟 ふきだしの位置。
//    対象が縦に長いと、下に出したふきだしが画面の外へはみ出して
//    「次へ」が押せなくなる。ふきだしの高さを実際に測ってから、
//    入るほうへ置き、最後に必ず画面内へ収める。
const popEl = ref(null);
const popH = ref(0);
const viewport = ref({ w: window.innerWidth, h: window.innerHeight });
const MARGIN = 12; // 画面の端に残す余白

const onResize = () => { measure(); measurePop(); };

const measurePop = () => {
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  if (popEl.value) popH.value = popEl.value.offsetHeight;
};

const popStyle = computed(() => {
  const vw = viewport.value.w;
  const vh = viewport.value.h;
  const w = Math.min(440, vw - 32);
  const left = Math.max(16, (vw - w) / 2);
  const ph = popH.value || 220; // まだ測れていないときの目安
  const base = { width: w + 'px', left: left + 'px', maxHeight: (vh - MARGIN * 2) + 'px' };
  const clamp = (top) => Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - ph - MARGIN));

  if (isFinal.value || !hole.value) {
    return { ...base, top: clamp((vh - ph) / 2) + 'px' };
  }

  const h = hole.value;
  const below = vh - (h.top + h.height) - 14; // 下に置ける高さ
  const above = h.top - 14;                   // 上に置ける高さ
  let top;
  if (below >= ph) top = h.top + h.height + 14;
  else if (above >= ph) top = h.top - 14 - ph;
  else top = (vh - ph) / 2; // どちらにも入らない＝真ん中に出す
  return { ...base, top: clamp(top) + 'px' };
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
    nextTick(() => requestAnimationFrame(measurePop));
    return;
  }

  const el = document.querySelector(step.sel);
  if (!el) {
    // イベント詳細は Firestore 読込で遅れるので長めに待つ（25回×150ms）。
    // optional は「無いこともある」場所なので、待たずに飛ばす（5回×150ms）。
    const limit = step.optional ? 5 : 25;
    if (attempt < limit) {
      retryTimer = setTimeout(() => locate(attempt + 1), 150);
    } else {
      advance(); // 見つからないステップは飛ばす
    }
    return;
  }

  curEl = el;
  // 戻るときに同じ画面へ帰れるよう、そのステップを見た画面を控えておく
  stepPaths[stepIndex.value] = router.currentRoute.value.path;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  requestAnimationFrame(() => {
    measure();
    // ふきだしの中身が入れ替わったあとに測らないと、前のステップの高さで置いてしまう
    nextTick(() => requestAnimationFrame(measurePop));
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

// 🌟 1つ前へ戻る。
//    ツアーの途中には実際に画面を移動するステップがあるので、戻る前に
//    そのステップを見ていた画面へ帰す。＋のシートの中のステップだけは
//    シートが閉じているので開き直す（開いていないと対象が見つからず、
//    locate の再試行のあと勝手に先へ進んでしまう）。
const back = async () => {
  const target = stepIndex.value - 1;
  if (target < 0 || goingBack.value) return;
  goingBack.value = true;
  try {
    clearRetry();
    detachAction();
    const step = STEPS[target];
    const wantPath = stepPaths[target];
    if (wantPath && router.currentRoute.value.path !== wantPath) {
      await router.push(wantPath);
      await nextTick();
      await new Promise(r => setTimeout(r, 250));
    }
    if (step?.sel?.includes('data-tour="sheet-') && !document.querySelector('.addsheet')) {
      document.querySelector('[data-tour="nav-add"]')?.click();
      await new Promise(r => setTimeout(r, 350));
    }
    stepIndex.value = target;
    locate(0);
  } finally {
    goingBack.value = false;
  }
};

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
  stepPaths.length = 0;
  window.addEventListener('resize', onResize);
  await nextTick();
  setTimeout(() => locate(0), 100);
};

const end = () => {
  clearRetry();
  detachAction();
  window.removeEventListener('resize', onResize);
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
  window.removeEventListener('resize', onResize);
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
  /* それでも入りきらないときは中で送れるようにする（「次へ」を画面外に出さない） */
  overflow-y: auto;
  overscroll-behavior: contain;
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
.tour__left { display: flex; align-items: center; gap: 4px; }
.tour__back {
  background: none; border: none;
  color: var(--c-text-sub, #6b7280);
  font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 8px; border-radius: 999px;
}
.tour__back:disabled { opacity: 0.5; cursor: default; }
.tour__back:active { background: var(--c-line, #eef2f7); }
.tour__skip {
  background: none; border: none;
  color: var(--c-text-faint, #94a3b8);
  font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 2px;
}
.tour__count { flex-shrink: 0; font-size: 10px; font-weight: 700; color: var(--c-text-faint, #94a3b8); white-space: nowrap; }
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
