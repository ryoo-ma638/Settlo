<template>
  <section v-if="show" class="try">
    <template v-if="current">
      <div class="try__head">
        <span class="try__no">{{ index + 1 }}</span>
        <span class="try__title">{{ current.title }}</span>
        <span class="try__count">{{ progress.done }}/{{ progress.total }}</span>
      </div>

      <button type="button" class="btn-brand try__go" @click="run(current)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
          <path d="M6 12a6 6 0 0 1 12 0" /><path d="M3.5 12a8.5 8.5 0 0 1 17 0" />
        </svg>
        案内をはじめる
      </button>
      <p class="try__note">光ったボタンを押すだけ</p>
    </template>

    <template v-else>
      <p class="try__done">ひと通り試せました</p>
    </template>

    <div class="try__links">
      <button type="button" class="try__toggle" @click="open = !open">
        {{ open ? '閉じる' : `ぜんぶ見る（残り${progress.total - progress.done}件）` }}
      </button>
      <button v-if="current" type="button" class="try__toggle" @click="askSkip">案内をスキップ</button>
    </div>

    <ol v-if="open" class="try__list">
      <li v-for="(step, i) in steps" :key="step.id">
        <button
          type="button"
          class="try__row"
          :class="{ 'is-done': isDone(step.id), 'is-now': current && current.id === step.id }"
          @click="run(step)"
        >
          <span class="try__mark" aria-hidden="true">
            <svg v-if="isDone(step.id)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="try__row-title">{{ step.title }}</span>
          <span class="try__row-time">{{ step.minutes }}</span>
        </button>
      </li>
    </ol>

    <BaseModal
      :show="confirmSkip"
      type="warning"
      title="案内をスキップしますか？"
      message="案内を閉じて、ふつうに触れる状態にします。
上の「初めての方へ」からいつでも戻せます。"
      :showCancel="true"
      confirmText="スキップ"
      cancelText="やめる"
      @confirm="doSkip"
      @cancel="confirmSkip = false"
      @close="confirmSkip = false"
    />
  </section>
</template>

<script setup>
// 🌟 お試し（ゲスト）で入った人の「触ってみる」。
//    以前はホームに7件まとめて出していたが、一度に並ぶと読みづらく、
//    どのボタンを押せばいいかも分からなかった。
//    ここではアシスタントの中に「いまの1件だけ」を出し、
//    押すと実際のボタンを1つずつ光らせて最後まで案内する。
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { GUEST_TRAIL, trailProgress, nextTrailStep, normalizeDone } from '@/lib/guestTrail.js';
import { TRAIL_KEY } from '@/lib/guestGuide.js';
import { TRAIL_DONE_EVENT, startGuidedTask } from '@/lib/trailProgressSignal.js';
import { TRAIL_HIDDEN_KEY } from '@/lib/guestGuide.js';
import BaseModal from './BaseModal.vue';

const emit = defineEmits(['start', 'skip']); // start=案内を始めた／skip=お試しをやめた

const steps = GUEST_TRAIL;
const isGuest = ref(false);
const done = ref([]);
const open = ref(false);

const load = () => {
  try {
    const raw = localStorage.getItem(TRAIL_KEY);
    done.value = normalizeDone(raw ? JSON.parse(raw) : []);
  } catch (e) { done.value = []; }
};

const progress = computed(() => trailProgress(done.value));
const current = computed(() => nextTrailStep(done.value));
const index = computed(() => (current.value ? steps.indexOf(current.value) : -1));
const isDone = (id) => done.value.includes(id);
const show = computed(() => isGuest.value);

const run = (step) => {
  if (!startGuidedTask(step)) return;
  emit('start');
};

const onDone = () => load();

// 🌟 お試しをやめる。押し間違いで案内が消えると戻し方が分からなくなるので、一度たずねる。
const confirmSkip = ref(false);
const askSkip = () => { confirmSkip.value = true; };
const doSkip = () => {
  confirmSkip.value = false;
  try { localStorage.setItem(TRAIL_HIDDEN_KEY, JSON.stringify(true)); } catch (e) {}
  emit('skip');
};

onMounted(() => {
  load();
  window.addEventListener(TRAIL_DONE_EVENT, onDone);
  isGuest.value = auth.currentUser?.isAnonymous === true;
  onAuthStateChanged(auth, (user) => { isGuest.value = user?.isAnonymous === true; });
});
onUnmounted(() => window.removeEventListener(TRAIL_DONE_EVENT, onDone));
</script>

<style scoped>
.try {
  background: var(--c-surface);
  border: 1px solid var(--c-brand);
  border-radius: var(--r-lg);
  padding: 12px 14px 8px;
  margin: 12px var(--pad) 0;
  box-shadow: var(--shadow-card);
}
.try__head { display: flex; align-items: center; gap: 9px; }
.try__no {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  background: var(--c-brand); color: #fff; font-size: 12.5px; font-weight: var(--fw-bold);
}
.try__title { flex: 1; min-width: 0; font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); line-height: 1.4; }
.try__count { flex-shrink: 0; font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand-strong); font-variant-numeric: tabular-nums; }

.try__go { margin-top: 12px; min-height: 48px; padding: 12px 16px; font-size: 15px; }
.try__go svg { width: 17px; height: 17px; flex-shrink: 0; }
.try__note { margin: 6px 0 0; font-size: 11px; color: var(--c-text-faint); text-align: center; }
.try__done { margin: 0; font-size: 14px; font-weight: var(--fw-bold); color: var(--c-brand-strong); text-align: center; }

.try__links { display: flex; gap: 8px; margin-top: 8px; }
.try__toggle { flex: 1; min-height: 40px; padding: 8px 6px; background: none; border: 0; font-size: 11.5px; color: var(--c-text-sub); text-decoration: underline; cursor: pointer; }

.try__list { list-style: none; margin: 4px 0 0; padding: 0; border-top: 1px solid var(--c-line); }
.try__row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 2px; background: none; border: 0; text-align: left; cursor: pointer; }
.try__list li + li .try__row { border-top: 1px solid var(--c-line); }
.try__mark {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--c-surface-2); color: var(--c-text-sub);
  font-size: 11px; font-weight: var(--fw-bold);
}
.try__row.is-done .try__mark { background: var(--c-brand-tint); color: var(--c-brand-strong); }
.try__mark svg { width: 13px; height: 13px; }
.try__row.is-now .try__mark { background: var(--c-brand); color: #fff; }
.try__row-title { flex: 1; min-width: 0; font-size: 12.5px; color: var(--c-ink); line-height: 1.4; }
.try__row.is-done .try__row-title { color: var(--c-text-sub); }
.try__row-time { flex-shrink: 0; font-size: 10.5px; color: var(--c-text-faint); }

.try__go:focus-visible, .try__toggle:focus-visible, .try__row:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 2px; }
</style>
