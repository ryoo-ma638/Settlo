<template>
  <Teleport to="body">
    <transition name="ob-fade">
      <div v-if="show" class="ob-overlay">
        <div class="ob-card">
          <!-- スライド -->
          <div class="ob-slide">
            <div class="ob-illust" :class="`ob-illust--${step}`">
              <!-- 1: ようこそ -->
              <svg v-if="step === 0" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14l2 2 4-4"/></svg>
              <!-- 2: レシート -->
              <svg v-else-if="step === 1" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/><circle cx="17.5" cy="17.5" r="4" fill="var(--c-brand)" stroke="none"/><path d="M15.8 17.5l1.2 1.2 2.2-2.2" stroke="#fff"/></svg>
              <!-- 3: 精算 -->
              <svg v-else-if="step === 2" viewBox="0 0 24 24"><path d="M7 10l-3 3 3 3M17 4l3 3-3 3"/><path d="M4 13h13M20 7H7"/></svg>
              <!-- 4: 安心 -->
              <svg v-else viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            </div>
            <h2 class="ob-title">{{ slides[step].title }}</h2>
            <p class="ob-text">{{ slides[step].text }}</p>
          </div>

          <!-- ドット -->
          <div class="ob-dots">
            <span v-for="(s, i) in slides" :key="i" class="ob-dot" :class="{ 'is-on': i === step }" @click="step = i"></span>
          </div>

          <!-- ボタン -->
          <div class="ob-actions">
            <button v-if="step < slides.length - 1" class="btn-brand ob-next" @click="step++">次へ</button>
            <button v-else class="btn-brand ob-next" @click="finish">はじめる</button>
            <button class="ob-skip" @click="finish">スキップ</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { auth } from '../firebase';

const show = ref(false);
const step = ref(0);

const slides = [
  {
    title: 'ようこそ Settlo へ！',
    text: '旅行や飲み会の立て替えを、イベントごとにかんたん記録。仲間を招待して、割り勘をもっとスマートに。',
  },
  {
    title: 'レシートはAIにおまかせ',
    text: 'レシートを撮るだけで、店名・金額・商品・消費税まで自動入力。商品ごとに「誰が払うか」も選べます。',
  },
  {
    title: '精算は最小回数でまとめて',
    text: '貸し借りを自動で相殺して、いちばん少ない送金回数に。PayPayリンクや現金＋承認でスッキリ完了。',
  },
  {
    title: '間違えても、勝手に消されても安心',
    text: '削除・変更は相手に「正しいですか？」の確認が届き、ゴミ箱から7日以内なら元に戻せます。使い方はヘルプ（マイページ）からいつでも確認できます。',
  },
];

const KEY = 'settlo_onboarding_done';

const finish = () => {
  show.value = false;
  try { localStorage.setItem(KEY, '1'); } catch (e) {}
};

// ログイン済みかつ初回のみ表示（「もう一度見る」イベントでも表示）
const maybeShow = () => {
  try {
    if (!localStorage.getItem(KEY) && auth.currentUser) {
      step.value = 0;
      show.value = true;
    }
  } catch (e) {}
};
const forceShow = () => { step.value = 0; show.value = true; };

onMounted(() => {
  // 認証確定を少し待ってから判定（App.vue のリダイレクト後）
  setTimeout(maybeShow, 800);
  window.addEventListener('settlo:show-onboarding', forceShow);
});
onUnmounted(() => window.removeEventListener('settlo:show-onboarding', forceShow));
</script>

<style scoped>
.ob-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  z-index: 90000;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  backdrop-filter: blur(3px);
}
.ob-card {
  width: 100%; max-width: 340px;
  background: var(--c-surface, #fff);
  border-radius: 24px;
  padding: 30px 24px 22px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.ob-illust {
  width: 96px; height: 96px;
  margin: 0 auto 18px;
  border-radius: 28px;
  background: var(--c-brand-weak, #ecfdf5);
  display: flex; align-items: center; justify-content: center;
}
.ob-illust svg {
  width: 52px; height: 52px;
  fill: none; stroke: var(--c-brand, #059669); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
}

.ob-title { font-size: 19px; font-weight: var(--fw-black, 900); color: var(--c-ink); margin: 0 0 10px; }
.ob-text { font-size: 14px; line-height: 1.8; color: var(--c-text-sub); margin: 0 0 18px; min-height: 100px; }

.ob-dots { display: flex; justify-content: center; gap: 7px; margin-bottom: 18px; }
.ob-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-line-bold, #d7dbe0);
  transition: all 0.2s ease;
  cursor: pointer;
}
.ob-dot.is-on { background: var(--c-brand); width: 22px; border-radius: 999px; }

.ob-actions { display: flex; flex-direction: column; gap: 6px; }
.ob-next { width: 100%; }
.ob-skip {
  padding: 10px;
  font-size: 13px; font-weight: var(--fw-bold);
  color: var(--c-text-faint);
  background: none; border: none;
}

.ob-fade-enter-active, .ob-fade-leave-active { transition: opacity 0.25s ease; }
.ob-fade-enter-from, .ob-fade-leave-to { opacity: 0; }
</style>
