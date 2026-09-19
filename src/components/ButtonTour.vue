<template>
  <Teleport to="body">
    <!-- 🌟 お試しの手順をやり切ったとき。次の手順へ戻す。 -->
    <div v-if="active && doneView" class="tour">
      <div class="tour__backdrop"></div>
      <div class="tour__pop tour__pop--done">
        <span class="tour__done-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
        </span>
        <p class="tour__pop-title">{{ doneView.title }}</p>
        <p class="tour__pop-desc">{{ doneView.desc }}</p>
        <button class="btn-brand tour__done-btn" @click="finishTask">{{ doneView.cta }}</button>
      </div>
    </div>

    <div v-else-if="active && currentStep" class="tour">
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
        <p class="tour__pop-title">
          <svg v-if="currentStep.type === 'action'" class="tour__hand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            <path d="M6 12a6 6 0 0 1 12 0" /><path d="M3.5 12a8.5 8.5 0 0 1 17 0" />
          </svg>
          {{ currentStep.title }}
        </p>
        <p v-if="currentStep.desc" class="tour__pop-desc">{{ currentStep.desc }}</p>

        <div class="tour__pop-foot">
          <span class="tour__left">
            <button class="tour__skip" @click="end">やめる</button>
            <button v-if="stepIndex > 0" class="tour__back" :disabled="goingBack" @click="back">戻る</button>
          </span>
          <span class="tour__count">{{ stepIndex + 1 }} / {{ STEPS.length }}</span>
          <button v-if="isFinal" class="tour__next" @click="finishHome">ホームへ戻る</button>
          <button v-else-if="currentStep.type === 'action'" class="tour__force" @click="forceAction">次へ</button>
          <button v-else class="tour__next" @click="next">次へ</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { markTrailDone, GUIDED_TASK_EVENT, CLOSE_OVERLAYS_EVENT, OPEN_ASSISTANT_EVENT, TOUR_STATE_EVENT } from '@/lib/trailProgressSignal.js';
import { GUEST_TRAIL, nextTrailStep, trailProgress, normalizeDone } from '@/lib/guestTrail.js';
import { TRAIL_KEY } from '@/lib/guestGuide.js';

// 端末に残っている「済み」を読む
// 案内が動いているかを画面のほかの部分へ伝える
const 告げる = (on) => {
  try { window.dispatchEvent(new CustomEvent(TOUR_STATE_EVENT, { detail: { active: on } })); } catch (e) {}
};

const readDone = () => {
  try { return normalizeDone(JSON.parse(localStorage.getItem(TRAIL_KEY) || '[]')); } catch (e) { return []; }
};

const router = useRouter();
const active = ref(false);
const stepIndex = ref(0);
const goingBack = ref(false);
const stepPaths = []; // ステップ番号 → そのとき見ていた画面のパス
const rect = ref(null); // 対象要素の位置（{top,left,width,height}）。final は null。

// 穴のまわりに付ける余白（px）
const PAD = 8;

// ツアーの手順。sel は data-tour 属性。type = explain（説明のみ）/ action（実際に押して進む）/ final（締め）。
const FULL_TOUR = [
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

// 🌟 手順は差し替えられる。
//    ・マイページの「アプリの使い方」＝全画面ツアー（FULL_TOUR）
//    ・お試しの「触ってみる」＝1つの作業だけを最後まで案内する短い手順
//      （settlo:start-guided-task で渡される）
const STEPS = ref(FULL_TOUR);
const taskId = ref(null);   // お試しの手順のときだけ入る
const completed = ref(false); // 最後まで行ったか（途中でやめたのと区別する）
const skipped = ref(0);       // 対象が見つからず飛ばした数
const doneView = ref(null);   // やり切ったときに出す画面
const currentStep = computed(() => STEPS.value[stepIndex.value]);
const isFinal = computed(() => currentStep.value?.type === 'final');

const popEl = ref(null);
const popH = ref(0);
const viewport = ref({ w: window.innerWidth, h: window.innerHeight });
const MARGIN = 12; // 画面の端に残す余白

// 対象の矩形に余白を足した「穴」。
// 🌟 画面の外へはみ出さないよう端で止める（リングが切れて見えないため）。
// 🌟 対象が画面の半分より高いときは、上のほうだけ開ける。
//    全部開けるとふきだしの置き場所が無くなり、光るボタンの上に重なって押せなくなる。
const hole = computed(() => {
  if (!rect.value) return null;
  const vw = viewport.value.w;
  const vh = viewport.value.h;
  const top = Math.max(MARGIN / 2, rect.value.top - PAD);
  const left = Math.max(MARGIN / 2, rect.value.left - PAD);
  const right = Math.min(vw - MARGIN / 2, rect.value.left + rect.value.width + PAD);
  const bottomRaw = Math.min(vh - MARGIN / 2, rect.value.top + rect.value.height + PAD);
  const tall = Math.round(vh * 0.5);
  const height = Math.min(bottomRaw - top, tall);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, height) };
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

const onResize = () => { measure(); measurePop(); };

const measurePop = () => {
  viewport.value = { w: window.innerWidth, h: window.innerHeight };
  if (popEl.value) popH.value = popEl.value.offsetHeight;
};

const popStyle = computed(() => {
  const vw = viewport.value.w;
  const vh = viewport.value.h;
  const w = Math.min(340, vw - 32); // 画面をふさがないよう細めにする
  const left = Math.max(16, (vw - w) / 2);
  const ph = popH.value || 220; // まだ測れていないときの目安
  const base = { width: w + 'px', left: left + 'px', maxHeight: (vh - MARGIN * 2) + 'px' };
  const clamp = (top) => Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - ph - MARGIN));

  if (isFinal.value || !hole.value) {
    return { ...base, top: clamp((vh - ph) / 2) + 'px' };
  }

  // 🌟 光るボタンの上に重ねない。
  //    入り切らないときは、広いほうへ寄せてふきだし自体を縮める（中はスクロール）。
  //    真ん中に出すと、押したい場所をふきだしが塞いで先へ進めなくなる。
  const h = hole.value;
  const GAP = 14;
  const below = vh - (h.top + h.height) - GAP - MARGIN; // 下に使える高さ
  const above = h.top - GAP - MARGIN;                   // 上に使える高さ
  const MIN = 132;
  let top;
  let maxH = vh - MARGIN * 2;
  if (below >= ph) top = h.top + h.height + GAP;
  else if (above >= ph) top = h.top - GAP - ph;
  else if (below >= above) { maxH = Math.max(MIN, below); top = h.top + h.height + GAP; }
  else { maxH = Math.max(MIN, above); top = h.top - GAP - maxH; }
  return { ...base, top: clamp(top) + 'px', maxHeight: Math.min(maxH, vh - MARGIN * 2) + 'px' };
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
      // 見つからないステップは飛ばす。飛ばした分は「やった」ことにしない。
      if (!step.optional) skipped.value += 1;
      advance();
    }
    return;
  }

  curEl = el;
  // 戻るときに同じ画面へ帰れるよう、そのステップを見た画面を控えておく
  stepPaths[stepIndex.value] = router.currentRoute.value.path;
  // 画面の半分より高いものは上寄せ。中央寄せだと上下に場所が残らず、
  // ふきだしを置けなくなる。
  const tall = el.getBoundingClientRect().height > window.innerHeight * 0.45;
  el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest' });
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
  if (i >= STEPS.value.length) {
    completed.value = true;
    // お試しの手順を、飛ばさずにやり切ったときは「できました」を出して次へ戻す
    if (taskId.value && skipped.value === 0) { showDone(); return; }
    end();
    return;
  }
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
    const step = STEPS.value[target];
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

// 🌟 やり切ったところで印を付け、「次の手順へ」を出す。
//    ここで戻してあげないと、開いたままの覆いや今いる画面から
//    自分でアシスタントまで帰らないといけない。
const showDone = () => {
  clearRetry();
  detachAction();
  const id = taskId.value;
  markTrailDone(id);
  const step = GUEST_TRAIL.find((t) => t.id === id);
  const next = nextTrailStep(readDone());
  const p = trailProgress(readDone());
  doneView.value = next
    ? {
        title: 'できました',
        desc: `${p.done}/${p.total} 済み。次は「${next.title}」`,
        cta: '次へ進む',
      }
    : {
        title: 'ひと通り試せました',
        desc: `${p.total}件ぜんぶ済みです`,
        cta: 'ホームへ戻る',
      };
  rect.value = null;
  curEl = null;
};

const finishTask = async () => {
  const もう無い = !nextTrailStep(readDone());
  doneView.value = null;
  // 開いたままの覆い（お知らせなど）を閉じて、ホームへ戻す
  try { window.dispatchEvent(new CustomEvent(CLOSE_OVERLAYS_EVENT)); } catch (e) {}
  end();
  if (router.currentRoute.value.path !== '/') await router.push('/');
  if (!もう無い) {
    await nextTick();
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT)); } catch (e) {} }, 250);
  }
};

// --- 開始・終了 ---
const begin = async ({ steps, id, fromHome }) => {
  if (fromHome && router.currentRoute.value.path !== '/') {
    await router.push('/');
  }
  STEPS.value = steps;
  taskId.value = id || null;
  completed.value = false;
  skipped.value = 0;
  doneView.value = null;
  active.value = true;
  告げる(true);
  stepIndex.value = 0;
  stepPaths.length = 0;
  window.addEventListener('resize', onResize);
  await nextTick();
  setTimeout(() => locate(0), 100);
};

// 全画面ツアー（マイページ →「アプリの使い方」）
const start = () => begin({ steps: FULL_TOUR, id: null, fromHome: true });

// 🌟 お試しの「触ってみる」。1つの作業だけを、実際のボタンを光らせて最後まで案内する。
//    今いる画面から始める（下のナビを押すところから案内するため）。
const startTask = (event) => {
  const detail = event && event.detail;
  const steps = detail && Array.isArray(detail.steps) ? detail.steps : null;
  if (!steps || steps.length === 0) return;
  begin({ steps, id: detail.id, fromHome: false });
};

const end = () => {
  clearRetry();
  detachAction();
  window.removeEventListener('resize', onResize);
  const wasTask = taskId.value;
  // 飛ばしたステップがあるなら、最後まで行っても「やった」ことにしない。
  // やり切った分は showDone() で先に印を付けてある。
  const wasDone = completed.value && skipped.value === 0 && !doneView.value;
  active.value = false;
  告げる(false);
  curEl = null;
  rect.value = null;
  // 全画面ツアーのときだけ、開いたままの「＋」選択シートを閉じる。
  // お試しの手順は、シートの中で続けてもらうことがあるので触らない。
  if (!wasTask) document.querySelector('[data-tour="sheet-cancel"]')?.click();
  // 最後まで行ったときだけ済みにする。途中でやめた分は済みにしない。
  if (wasTask && wasDone) markTrailDone(wasTask);
  taskId.value = null;
  completed.value = false;
  skipped.value = 0;
  doneView.value = null;
};

const finishHome = () => {
  router.push('/');
  end();
};

onMounted(() => {
  window.addEventListener('settlo:show-button-tour', start);
  window.addEventListener(GUIDED_TASK_EVENT, startTask);
});
onUnmounted(() => {
  window.removeEventListener('settlo:show-button-tour', start);
  window.removeEventListener(GUIDED_TASK_EVENT, startTask);
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
  /* いちばん前に出す。お知らせ（9000）・確認（99999）より下に置くと、
     光らせたいボタンがモーダルの中にあるとき、ふきだしが後ろへ回って押せなくなる。 */
  z-index: 100002;
  pointer-events: none;
}

/* 暗幕（4枚のシールド＋最終の全面幕） */
.tour__shield,
.tour__backdrop {
  position: fixed;
  /* 画面を真っ暗にすると、どんなアプリなのかが見えない。
     うっすら掛けて、光る場所だけ明るく残す。 */
  background: rgba(15, 23, 42, 0.34);
  pointer-events: auto;
}
.tour__backdrop { inset: 0; background: rgba(15, 23, 42, 0.5); }

/* 穴の縁の白枠リング */
.tour__ring {
  position: fixed;
  border: 3px solid var(--c-brand);
  border-radius: 14px;
  pointer-events: none;
  box-shadow: 0 0 0 2px #fff, 0 0 0 6px rgba(5, 150, 105, 0.35), 0 6px 20px rgba(15, 23, 42, 0.25);
  animation: tour-ring 1.6s ease-out infinite;
}
@keyframes tour-ring {
  0%, 100% { box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(5, 150, 105, 0.3), 0 6px 20px rgba(15, 23, 42, 0.25); }
  50% { box-shadow: 0 0 0 2px #fff, 0 0 0 10px rgba(5, 150, 105, 0.16), 0 6px 20px rgba(15, 23, 42, 0.25); }
}
@media (prefers-reduced-motion: reduce) { .tour__ring { animation: none; } }

/* explain のとき、対象を押せなくする透明ブロッカー */
.tour__blocker {
  position: fixed;
  border-radius: 14px;
  pointer-events: auto;
}

/* ふきだし */
.tour__pop {
  position: fixed;
  z-index: 100004;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  background: var(--c-surface);
  border-radius: var(--r-md);
  padding: 11px 14px 9px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.3);
  pointer-events: auto;
  /* それでも入りきらないときは中で送れるようにする（「次へ」を画面外に出さない） */
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tour__pop-title { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; color: var(--c-ink); margin: 0; line-height: 1.45; }
.tour__hand { flex-shrink: 0; width: 16px; height: 16px; color: var(--c-brand); }
.tour__pop-desc { font-size: 12px; color: var(--c-text-sub); line-height: 1.55; margin: 5px 0 0; }

.tour__badge {
  margin-top: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--c-brand);
  background: var(--c-brand-weak);
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
  color: var(--c-text-sub);
  font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 8px; border-radius: 999px;
}
.tour__back:disabled { opacity: 0.5; cursor: default; }
.tour__back:active { background: var(--c-line); }
.tour__skip {
  background: none; border: none;
  color: var(--c-text-faint);
  font-size: 12px; font-weight: 700; cursor: pointer;
  padding: 6px 2px;
}
.tour__count { flex-shrink: 0; font-size: 10px; font-weight: 700; color: var(--c-text-faint); white-space: nowrap; }
.tour__next {
  background: var(--c-brand); color: #fff;
  border: none; border-radius: 999px;
  padding: 9px 20px; font-size: 13px; font-weight: 800; cursor: pointer;
}
.tour__next:active { transform: scale(0.97); }
.tour__force {
  background: none; border: none;
  color: var(--c-text-faint);
  font-size: 12px; font-weight: 700; cursor: pointer;
  text-decoration: underline; padding: 6px 2px;
}

/* やり切ったときの画面 */
.tour__pop--done { text-align: center; }
.tour__done-mark {
  width: 46px; height: 46px; margin: 0 auto 10px;
  border-radius: 50%; background: var(--c-brand-weak); color: var(--c-brand);
  display: flex; align-items: center; justify-content: center;
}
.tour__done-mark svg { width: 24px; height: 24px; }
.tour__done-btn { min-height: 48px; margin-top: 14px; font-size: 15px; }
.tour__done-btn:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 2px; }
</style>
