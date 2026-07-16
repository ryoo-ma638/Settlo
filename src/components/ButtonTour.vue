<template>
  <Teleport to="body">
    <div v-if="active" class="xmode">
      <!-- 下部の案内バー（フッターの上に浮かせる・操作の邪魔をしない） -->
      <div class="xmode__bar">
        <span class="xmode__bar-txt">説明モード：光るボタンをタップすると使い方が出ます</span>
        <button class="xmode__bar-end" @click="end">終了</button>
      </div>

      <!-- タップしたボタンの説明ふきだし（必ず画面内に収める） -->
      <div v-if="current" class="xmode__pop" :style="popStyle">
        <p class="xmode__pop-title">{{ current.title }}</p>
        <p class="xmode__pop-desc">{{ current.desc }}</p>
        <div class="xmode__pop-actions">
          <button v-if="current.to" class="xmode__go" @click="go(current.to)">{{ current.goLabel || 'この画面へ進む' }} →</button>
          <button class="xmode__close" @click="current = null">閉じる</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const active = ref(false);
const current = ref(null);      // 表示中の説明 {title, desc, to?, goLabel?}
const anchor = ref(null);       // タップした要素の位置

// data-tour の目印ごとの説明。to があれば「この画面へ進む」を出す。
const REGISTRY = {
  avatar:      { title: 'マイページ（顔アイコン）', desc: 'プロフィール・お支払い履歴・ゴミ箱・承認待ち・チャット・使い方の入口です。', to: '/mypage', goLabel: 'マイページを開く' },
  pending:     { title: '承認待ち（時計）', desc: 'あなたが承認する分・相手の承認待ち・承認/拒否の履歴。催促されている支払いは一番上に赤く出ます。', to: '/approvals', goLabel: '承認待ちを開く' },
  chat:        { title: 'チャット（吹き出し）', desc: '支払いの件ごとに相談できます。未読の数がバッジで出て、解決すると自動で片付きます。', to: '/chats', goLabel: 'チャットを開く' },
  bell:        { title: 'お知らせ（ベル）', desc: '承認依頼・催促・「これは正しいですか？」の確認が届きます。押すとその場で開きます。' },
  assist:      { title: 'お支払いアシスタント（ロボット）', desc: 'いま承認する・支払う・催促する相手を、金額つきで教えてくれます。どの画面からでも開けます。' },
  'nav-home':  { title: 'ホーム', desc: '受け取る額・支払う額など、貸し借りがひと目でわかります。', to: '/', goLabel: 'ホームを開く' },
  'nav-event': { title: 'イベント', desc: '旅行・飲み会ごとに立て替えをまとめて精算します。', to: '/event', goLabel: 'イベントを開く' },
  'nav-add':   { title: '追加（＋）', desc: '「イベントを作成」で新しいイベント、「お支払いを追加」でイベントを選んで立て替えを記録します。' },
  'nav-money': { title: '支払い', desc: '受け取る額・支払う額・お支払い待ちの一覧です。', to: '/payment', goLabel: '支払いを開く' },
  'nav-friend':{ title: 'フレンド', desc: '友だちの追加・管理をします。', to: '/friend', goLabel: 'フレンドを開く' },
  'pay-tabs':  { title: '支払いの3つのタブ', desc: '「お支払い待ち（受け取る）」「未払い（支払う）」「まとめて」。まとめては相手ごとに相殺して、最小回数で精算できます。' },
  'pay-history':{ title: 'すべての履歴を見る', desc: 'これまでの支払い・受け取り・精算済みを、時系列でまとめて確認できます。', to: '/payment-history', goLabel: '履歴を開く' },
  'event-check':{ title: '精算を確認', desc: 'イベント一覧の右上から、支払い・精算の画面へ進めます。', to: '/payment', goLabel: '支払いを開く' },
  'friend-add':{ title: '友達を追加する', desc: '名前かIDで検索して申請します。同じイベントの人は候補に出ます。' },
  'mypage-menu':{ title: 'マイページのメニュー', desc: 'プロフィール変更・承認待ち・チャット・お支払い履歴・ゴミ箱、そして「アプリの使い方」の入口がまとまっています。' },
};

// 説明モード中は、アプリのボタン操作を止めて「説明の表示」に置き換える（安全）
const onCapture = (e) => {
  if (!active.value) return;
  if (e.target.closest('.xmode')) return; // 自分のUI（バー・ふきだし）は通常どおり
  e.preventDefault();
  e.stopPropagation();
  const el = e.target.closest('[data-tour]');
  if (el && REGISTRY[el.getAttribute('data-tour')]) {
    current.value = REGISTRY[el.getAttribute('data-tour')];
    anchor.value = el.getBoundingClientRect();
  } else {
    current.value = null; // 対象外をタップ＝ふきだしを閉じる
  }
};

const popStyle = computed(() => {
  const r = anchor.value; if (!r) return { display: 'none' };
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(320, vw - 24);
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(12, Math.min(left, vw - w - 12)); // 左右を画面内に収める
  const below = r.bottom < vh * 0.55;               // 対象が上寄りなら下に、下寄りなら上に
  const s = { left: `${Math.round(left)}px`, width: `${w}px` };
  if (below) s.top = `${Math.round(r.bottom + 12)}px`;
  else s.bottom = `${Math.round(vh - r.top + 12)}px`;
  return s;
});

const go = (to) => { current.value = null; router.push(to); }; // 移動しても説明モードは続く
const start = () => {
  active.value = true;
  document.body.classList.add('xmode-active');
  document.addEventListener('click', onCapture, true); // キャプチャ段階で先に横取り
};
const end = () => {
  active.value = false;
  current.value = null;
  document.body.classList.remove('xmode-active');
  document.removeEventListener('click', onCapture, true);
};

onMounted(() => window.addEventListener('settlo:show-button-tour', start));
onUnmounted(() => {
  window.removeEventListener('settlo:show-button-tour', start);
  document.removeEventListener('click', onCapture, true);
  document.body.classList.remove('xmode-active');
});
</script>

<!-- 説明モードのスタイルは全体に効かせる（他コンポーネントの [data-tour] を光らせるため非スコープ） -->
<style>
/* 説明モード中、説明できるボタンを光らせる */
body.xmode-active [data-tour] {
  outline: 2px dashed var(--c-brand);
  outline-offset: 2px;
  border-radius: 10px;
  cursor: help;
}

.xmode__bar {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h, 66px) + 12px);
  transform: translateX(-50%);
  z-index: 5000;
  display: flex; align-items: center; gap: 10px;
  max-width: calc(100vw - 24px);
  padding: 9px 10px 9px 14px;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
}
.xmode__bar-txt { color: #fff; font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.xmode__bar-end {
  flex-shrink: 0;
  background: #fff; color: var(--c-ink, #0f172a);
  border: none; border-radius: 999px;
  padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer;
}

.xmode__pop {
  position: fixed;
  z-index: 5001;
  box-sizing: border-box;
  max-height: 60vh; overflow-y: auto;
  background: var(--c-surface, #fff);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.3);
  border: 1px solid var(--c-line, #e5e7eb);
}
.xmode__pop-title { font-size: 14.5px; font-weight: 800; color: var(--c-ink, #0f172a); margin: 0 0 6px; }
.xmode__pop-desc { font-size: 13px; color: var(--c-text-sub, #475569); line-height: 1.65; margin: 0 0 13px; }
.xmode__pop-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.xmode__go {
  flex: 1; min-width: 140px;
  background: var(--c-brand, #16a34a); color: #fff;
  border: none; border-radius: 999px;
  padding: 9px 14px; font-size: 13px; font-weight: 800; cursor: pointer;
}
.xmode__go:active { transform: scale(0.97); }
.xmode__close {
  background: none; border: none;
  color: var(--c-text-faint, #94a3b8); font-size: 13px; font-weight: 700; cursor: pointer;
  padding: 9px 6px;
}
</style>
