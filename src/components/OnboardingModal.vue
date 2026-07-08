<template>
  <Teleport to="body">
    <transition name="ob-fade">
      <div v-if="show" class="ob-overlay">
        <div class="ob-card">
          <!-- スライド -->
          <div class="ob-slide">
            <!-- 1枚目はブランド、それ以降は実際の画面写真 -->
            <div v-if="!slides[step].image" class="ob-illust">
              <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M9 14l2 2 4-4"/></svg>
            </div>
            <div v-else class="ob-shot">
              <img :src="slides[step].image" alt="" />
            </div>

            <h2 class="ob-title">{{ slides[step].title }}</h2>
            <p class="ob-text">{{ slides[step].text }}</p>
            <p v-if="slides[step].tap" class="ob-tap">👆 {{ slides[step].tap }}</p>
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

// 実際の画面写真つきガイド（画像は public/tutorial/）
const slides = [
  {
    title: 'ようこそ Settlo へ！',
    text: '旅行や飲み会の立て替えを、イベントごとにかんたん記録。仲間を招待して、割り勘をもっとスマートに。実際の画面で使い方を見てみましょう。',
  },
  {
    image: './tutorial/home.jpg',
    title: 'ホームで貸し借りがひと目でわかる',
    text: '「受け取る額」と「支払う額」をまとめて表示。イベントはここから開けます。',
    tap: '新しいイベントは、下の緑の「＋」ボタンから作成',
  },
  {
    image: './tutorial/event.jpg',
    title: 'イベントに仲間を集める',
    text: '「＋ 招待」や招待コードのシェアでメンバーを追加。未精算の残りと進捗もここで確認できます。',
    tap: '立て替えたら「＋ 支払いを追加」をタップ',
  },
  {
    image: './tutorial/payment.jpg',
    title: 'レシートはAIにおまかせ',
    text: 'レシートを撮るだけで店名・金額・商品・消費税まで自動入力。割り勘は「均等／金額指定／商品ごと」から選べます。',
    tap: '点線の枠をタップしてレシートを撮影',
  },
  {
    image: './tutorial/notify.jpg',
    title: '通知で安心のやり取り',
    text: '催促・承認依頼・「これは正しいですか？」の確認がベルに届きます。間違えてもゴミ箱から7日以内なら元に戻せます。',
    tap: '右上のベルでお知らせ、「？」でいつでもヘルプ',
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
  padding: 20px;
  backdrop-filter: blur(3px);
}
.ob-card {
  width: 100%; max-width: 340px;
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
  background: var(--c-surface, #fff);
  border-radius: 24px;
  padding: 22px 22px 18px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
}

.ob-illust {
  width: 96px; height: 96px;
  margin: 26px auto 18px;
  border-radius: 28px;
  background: var(--c-brand-weak);
  display: flex; align-items: center; justify-content: center;
}
.ob-illust svg {
  width: 52px; height: 52px;
  fill: none; stroke: var(--c-brand); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
}

/* 実画面のスクリーンショット */
.ob-shot {
  width: 200px;
  margin: 0 auto 14px;
  border-radius: 18px;
  overflow: hidden;
  border: 4px solid var(--c-ink);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
  background: #fff;
}
.ob-shot img { display: block; width: 100%; height: 240px; object-fit: cover; object-position: top; }

.ob-title { font-size: 17px; font-weight: var(--fw-black, 900); color: var(--c-ink); margin: 0 0 8px; }
.ob-text { font-size: 13px; line-height: 1.75; color: var(--c-text-sub); margin: 0 0 8px; min-height: 68px; }
.ob-tap {
  font-size: 12.5px; font-weight: 800;
  color: var(--c-brand);
  background: var(--c-brand-weak);
  border-radius: 999px;
  padding: 7px 12px;
  margin: 0 0 4px;
  display: inline-block;
}

.ob-dots { display: flex; justify-content: center; gap: 7px; margin: 10px 0 14px; }
.ob-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-line-bold, #d7dbe0);
  transition: all 0.2s ease;
  cursor: pointer;
}
.ob-dot.is-on { background: var(--c-brand); width: 22px; border-radius: 999px; }

.ob-actions { display: flex; flex-direction: column; gap: 4px; }
.ob-next { width: 100%; }
.ob-skip {
  padding: 9px;
  font-size: 13px; font-weight: var(--fw-bold);
  color: var(--c-text-faint);
  background: none; border: none;
}

.ob-fade-enter-active, .ob-fade-leave-active { transition: opacity 0.25s ease; }
.ob-fade-enter-from, .ob-fade-leave-to { opacity: 0; }
</style>
