<template>
  <Teleport to="body">
    <div v-if="active" class="tour" @click.self="() => {}">
      <div class="tour__spot" :style="spotStyle"></div>
      <div class="tour__pop" :style="popStyle">
        <p class="tour__title">{{ step.title }}</p>
        <p class="tour__desc">{{ step.desc }}</p>
        <div class="tour__actions">
          <button class="tour__skip" @click="end">スキップ</button>
          <span class="tour__count">{{ index + 1 }} / {{ steps.length }}</span>
          <button class="tour__next" @click="next">{{ index === steps.length - 1 ? '完了' : '次へ' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// ヘッダー・下部ナビ・各画面のボタンを1つずつ強調して説明する。
// route を持つステップは、まずその画面に移動してから対象を光らせる（画面遷移しながら案内）。
const steps = [
  // ── ヘッダー（ホームで）
  { route: '/', sel: '[data-tour="avatar"]', title: 'マイページ（顔アイコン）', desc: 'プロフィール・お支払い履歴・ゴミ箱・承認待ち・チャット・使い方の入口です。' },
  { route: '/', sel: '[data-tour="pending"]', title: '承認待ち（時計）', desc: 'あなたが承認する分・相手の承認待ち・承認/拒否の履歴。催促されている支払いは一番上に赤く強調されます。' },
  { route: '/', sel: '[data-tour="chat"]', title: 'チャット（吹き出し）', desc: 'その件について相談できます。未読の数がバッジで出て、解決すると自動で片付きます。' },
  { route: '/', sel: '[data-tour="bell"]', title: 'お知らせ（ベル）', desc: '承認依頼・催促・「これは正しいですか？」の確認が届きます。' },
  { route: '/', sel: '[data-tour="assist"]', title: 'お支払いアシスタント（ロボット）', desc: '押すと開いて、いま承認する・支払う・催促する相手を金額つきで教えてくれます。どの画面からでも開けます。' },
  // ── 下部ナビ
  { route: '/', sel: '[data-tour="nav-home"]', title: 'ホーム', desc: '受け取る額・支払う額など、貸し借りがひと目でわかります。' },
  { route: '/', sel: '[data-tour="nav-event"]', title: 'イベント', desc: '旅行・飲み会ごとに立て替えをまとめて精算します。' },
  { route: '/', sel: '[data-tour="nav-add"]', title: '追加（＋）', desc: '押すと選べます：「イベントを作成」で新しいイベント、「お支払いを追加」でイベントを選んで立て替えを記録。' },
  { route: '/', sel: '[data-tour="nav-money"]', title: '支払い', desc: '受け取る額・支払う額・お支払い待ちの一覧です。' },
  { route: '/', sel: '[data-tour="nav-friend"]', title: 'フレンド', desc: '友だちの追加・管理をします。' },
  // ── ここから実際に画面をめぐる
  { route: '/payment', sel: '[data-tour="pay-tabs"]', title: '支払い・精算の3タブ', desc: '「お支払い待ち（受け取る）」「未払い（支払う）」「まとめて」。まとめては相手ごとに貸し借りを相殺して、最小回数で精算できます。' },
  { route: '/payment', sel: '[data-tour="pay-history"]', title: 'すべての履歴を見る', desc: 'これまでの支払い・受け取り・精算済みを、まとめて時系列で確認できます。' },
  { route: '/event', sel: '[data-tour="event-check"]', title: 'イベントから精算へ', desc: 'イベント一覧の右上。ここから精算の確認へ。イベントカードを押すと、その立て替え履歴・精算・支払い追加に入れます。' },
  { route: '/friend', sel: '[data-tour="friend-add"]', title: '友達を追加する', desc: '名前かIDで検索して申請。同じイベントの人は候補に出ます。カードを押すと、その相手との貸し借りをまとめて見られます。' },
  { route: '/mypage', sel: '[data-tour="mypage-menu"]', title: 'マイページの入口', desc: 'プロフィール変更・承認待ち・チャット・お支払い履歴・ゴミ箱、そして「アプリの使い方」。困ったらここに戻ってきてください。' },
];

const active = ref(false);
const index = ref(0);
const rect = ref(null);
const step = computed(() => steps[index.value] || {});

// 現在ステップの対象要素を探して光らせる（見つからなければ次へ）。画面遷移はしない。
const locate = () => {
  const st = steps[index.value];
  if (!st) { end(); return; }
  let tries = 0;
  const find = () => {
    if (!active.value) return;
    const el = document.querySelector(st.sel);
    if (el) {
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
      rect.value = el.getBoundingClientRect();
      // スクロール後の位置に微調整
      setTimeout(() => { if (active.value && steps[index.value] === st) rect.value = el.getBoundingClientRect(); }, 90);
      return;
    }
    // まだ描画されていないかもしれないので少し待って再試行
    if (tries++ < 15) { setTimeout(find, 120); return; }
    // それでも無ければこのステップは飛ばす
    if (index.value >= steps.length - 1) { end(); return; }
    index.value++;
    goToStep();
  };
  find();
};

// 必要なら画面を移動してから対象を光らせる
const goToStep = async () => {
  const st = steps[index.value];
  if (!st) { end(); return; }
  if (st.route && router.currentRoute.value.path !== st.route) {
    try { await router.push(st.route); } catch (e) {}
  }
  await nextTick();
  locate();
};

const spotStyle = computed(() => {
  const r = rect.value; if (!r) return { display: 'none' };
  const pad = 8;
  return {
    left: `${r.left - pad}px`, top: `${r.top - pad}px`,
    width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
  };
});
const popStyle = computed(() => {
  const r = rect.value; if (!r) return { display: 'none' };
  const below = r.top < window.innerHeight / 2; // 対象が上半分なら吹き出しは下、下半分なら上に
  const margin = 16;
  const w = Math.min(440, window.innerWidth - margin * 2);
  const left = (window.innerWidth - w) / 2;
  const s = { left: `${left}px`, width: `${w}px` };
  if (below) s.top = `${r.bottom + 18}px`;
  else s.bottom = `${window.innerHeight - r.top + 18}px`;
  return s;
});

const next = () => {
  if (index.value >= steps.length - 1) { end(); return; }
  index.value++;
  goToStep();
};
const end = () => {
  active.value = false;
  // ツアーの締めはホームに戻す
  if (router.currentRoute.value.path !== '/') router.push('/');
};
const start = () => {
  index.value = 0;
  active.value = true;
  nextTick(() => setTimeout(goToStep, 60));
};

// リサイズ時は移動せず、今の対象だけ測り直す
const onResize = () => {
  if (!active.value) return;
  const el = document.querySelector(steps[index.value]?.sel);
  if (el) rect.value = el.getBoundingClientRect();
};
onMounted(() => {
  window.addEventListener('settlo:show-button-tour', start);
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  window.removeEventListener('settlo:show-button-tour', start);
  window.removeEventListener('resize', onResize);
});
</script>

<style scoped>
.tour { position: fixed; inset: 0; z-index: 4000; }
.tour__spot {
  position: fixed; border-radius: 14px;
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.62);
  border: 2px solid #fff; pointer-events: none;
  transition: left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease;
}
.tour__pop {
  position: fixed; box-sizing: border-box;
  background: var(--c-surface); border-radius: 18px;
  padding: 16px 18px; box-shadow: var(--shadow-pop); pointer-events: auto;
}
.tour__title { font-size: 15px; font-weight: var(--fw-black); color: var(--c-ink); margin: 0 0 6px; }
.tour__desc { font-size: 13px; color: var(--c-text-sub); line-height: 1.65; margin: 0 0 14px; }
.tour__actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.tour__skip { background: none; border: none; color: var(--c-text-faint); font-size: 13px; font-weight: var(--fw-bold); cursor: pointer; }
.tour__count { font-size: 12px; color: var(--c-text-faint); font-weight: var(--fw-bold); }
.tour__next { background: var(--c-brand); color: #fff; border: none; padding: 10px 22px; border-radius: var(--r-pill); font-size: 14px; font-weight: var(--fw-black); cursor: pointer; }
.tour__next:active { transform: scale(0.96); }
</style>
