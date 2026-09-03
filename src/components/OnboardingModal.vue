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
            <p v-if="slides[step].tap" class="ob-tap">
              <svg class="ob-tap__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                <path d="M6 12a6 6 0 0 1 12 0" /><path d="M3.5 12a8.5 8.5 0 0 1 17 0" />
              </svg>
              {{ slides[step].tap }}
            </p>
          </div>

          <!-- ドット -->
          <div class="ob-dots">
            <span v-for="(s, i) in slides" :key="i" class="ob-dot" :class="{ 'is-on': i === step }" @click="step = i"></span>
          </div>

          <!-- 最後の1枚だけ：ツアーは自動で始まらず、いつでも呼び出せることを伝える -->
          <p v-if="step === slides.length - 1" class="ob-tour-note">
            使い方ツアー（ボタンを順番にご案内）は、マイページ →「アプリの使い方」からいつでも始められます。
          </p>

          <!-- ボタン -->
          <div class="ob-actions">
            <button v-if="step < slides.length - 1" class="btn-brand ob-next" @click="step++">次へ</button>
            <button v-else class="btn-brand ob-next" @click="finish()">さわってみる</button>
            <button class="ob-skip" @click="finish()">スキップ</button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { auth } from '../firebase';

const show = ref(false);
const step = ref(0);
const isGuest = ref(false); // ゲスト（匿名）で入場した人は短縮版を出す

// 実際の画面写真つきガイド（画像は public/tutorial/）
const ALL_SLIDES = [
  {
    image: './tutorial/g-home.jpg',
    title: 'ようこそ Settlo へ！',
    text: '旅行や飲み会の立て替えを記録して、まとめて精算できる割り勘アプリです。実際の画面で流れを見てみましょう。',
  },
  {
    image: './tutorial/g-event.jpg',
    title: 'イベントに仲間を集める',
    text: '旅行・飲み会ごとにイベントを作成。「＋ 招待」や招待コードのシェアでメンバーを追加できます。',
    tap: '立て替えたら「＋ 支払いを追加」をタップ',
  },
  {
    image: './tutorial/g-addpay.jpg',
    title: 'レシートはAIにおまかせ',
    text: 'レシートを撮るだけで店名・金額・消費税まで自動入力。割り勘は「均等/金額指定/商品ごと」から選べます。',
    tap: '点線の枠をタップしてレシートを撮影',
  },
  {
    image: './tutorial/g-settle.jpg',
    title: 'まとめて精算',
    text: '相手ごとに全イベントの貸し借りを相殺して、最小回数の送金にまとめます。',
    tap: '「支払い」→「まとめて」タブから',
  },
  {
    image: './tutorial/g-remind.jpg',
    title: '催促・受け取り・承認',
    text: 'PayPayリンクで請求、または催促の通知を送信。現金なら「受け取った/支払った」→相手の承認で完了します。',
  },
  {
    image: './tutorial/g-notify.jpg',
    title: 'お知らせが届く',
    text: '承認依頼・催促・「これは正しいですか？」の確認はベルに届きます。ホーム画面に追加すればプッシュ通知も受け取れます。',
    tap: '右上のベルをタップ',
  },
  {
    image: './tutorial/g-assistant.jpg',
    title: '迷ったらアシスタント',
    text: 'ヘッダー右のロボットが、いま支払う・催促する・承認する相手を金額つきで案内します。',
  },
];

// ゲスト（デモ）向けの短縮版。「何のアプリか」「レシート読み取り」「承認でもめない」の3枚に絞る。
// すぐ触ってもらうため、ツアーは自動で始めずマイページからの任意起動に任せる。
const GUEST_SLIDE_INDEXES = [0, 2, 4];
const GUEST_SLIDES = GUEST_SLIDE_INDEXES.map((i) => ALL_SLIDES[i]);

const slides = computed(() => (isGuest.value ? GUEST_SLIDES : ALL_SLIDES));

const KEY = 'settlo_onboarding_done';

const finish = () => {
  show.value = false;
  try { localStorage.setItem(KEY, '1'); } catch (e) {}
  // 以前はここから27ステップのボタンツアーを自動で始めていたが、
  // 読み終わるまで自由に触れないため既定オフにした。
  // ツアーはマイページ →「アプリの使い方」からいつでも起動できる（ButtonTour は残したまま）。
};

// ログイン済みかつ初回のみ表示（「もう一度見る」イベントでも表示）
const maybeShow = () => {
  try {
    if (!localStorage.getItem(KEY) && auth.currentUser) {
      isGuest.value = auth.currentUser.isAnonymous === true;
      step.value = 0;
      show.value = true;
    }
  } catch (e) {}
};
const forceShow = () => {
  isGuest.value = auth.currentUser?.isAnonymous === true;
  step.value = 0;
  show.value = true;
};

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
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ob-tap__icon { width: 15px; height: 15px; flex-shrink: 0; }

.ob-dots { display: flex; justify-content: center; gap: 7px; margin: 10px 0 14px; }
.ob-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-line-bold, #d7dbe0);
  transition: all 0.2s ease;
  cursor: pointer;
}
.ob-dot.is-on { background: var(--c-brand); width: 22px; border-radius: 999px; }

.ob-tour-note {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--c-text-faint);
  margin: 0 0 10px;
}

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
