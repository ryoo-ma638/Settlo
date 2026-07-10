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

// ヘッダー・下部ナビの各ボタンを1つずつ強調して説明する
const steps = [
  { sel: '[data-tour="avatar"]', title: 'マイページ', desc: 'プロフィール・お支払い履歴・ゴミ箱・承認待ち・チャットの入口です。' },
  { sel: '[data-tour="pending"]', title: '承認待ち', desc: 'あなたが承認する分・相手の承認待ち・承認/拒否の履歴。催促されている支払いは一番上に赤く強調されます。' },
  { sel: '[data-tour="chat"]', title: 'チャット', desc: 'その件について相談できます。未読の数がバッジで出て、解決すると自動で片付きます。' },
  { sel: '[data-tour="help"]', title: '使い方', desc: 'アプリの使い方。このガイドをもう一度見ることもできます。' },
  { sel: '[data-tour="bell"]', title: 'お知らせ', desc: '承認依頼・催促・「これは正しいですか？」の確認が届きます。' },
  { sel: '[data-tour="nav-home"]', title: 'ホーム', desc: '受け取る額・支払う額など、貸し借りがひと目でわかります。' },
  { sel: '[data-tour="nav-event"]', title: 'イベント', desc: '旅行・飲み会ごとに立て替えをまとめて精算します。' },
  { sel: '[data-tour="nav-add"]', title: '追加（＋）', desc: '新しいイベントや支払いをここから追加します。' },
  { sel: '[data-tour="nav-money"]', title: '支払い', desc: '受け取る額・支払う額・お支払い待ちの一覧です。' },
  { sel: '[data-tour="nav-friend"]', title: 'フレンド', desc: '友だちの追加・管理をします。' },
];

const active = ref(false);
const index = ref(0);
const rect = ref(null);
const step = computed(() => steps[index.value] || {});

const measure = () => {
  let tries = 0;
  const find = () => {
    const el = document.querySelector(step.value.sel);
    if (el) { rect.value = el.getBoundingClientRect(); return; }
    // 見つからないステップは飛ばす（多くても数個先まで）
    if (tries++ < steps.length) { index.value = (index.value + 1); if (index.value >= steps.length) { end(); return; } find(); }
    else end();
  };
  find();
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
  // 左右16pxの余白を確保しつつ最大440pxで画面中央に。px実測で確実に収める
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
  nextTick(measure);
};
const end = () => { active.value = false; };
const start = () => { index.value = 0; active.value = true; nextTick(() => setTimeout(measure, 60)); };

const onResize = () => { if (active.value) measure(); };
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
