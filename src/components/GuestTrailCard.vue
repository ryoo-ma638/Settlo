<template>
  <section v-if="show" class="trail" :class="{ 'trail--open': open }">
    <button class="trail__head" type="button" :aria-expanded="open" @click="open = !open">
      <span class="trail__head-main">
        <span class="trail__title">{{ finished ? 'ひと通り試せました' : '3〜5分でひと通り試す' }}</span>
        <span class="trail__sub">{{ finished ? 'ほかの画面はマイページ →「ヘルプ・使い方」から' : nextStep ? `つぎ：${nextStep.title}` : '' }}</span>
      </span>
      <span class="trail__count">{{ progress.done }}/{{ progress.total }}</span>
      <span class="trail__chev" :class="{ 'is-open': open }" aria-hidden="true">⌄</span>
    </button>

    <div v-if="open" class="trail__body">
      <ol class="trail__list">
        <li v-for="(step, index) in steps" :key="step.id">
          <button
            class="trail__step"
            :class="{ 'is-done': isDone(step.id), 'is-next': nextStep && nextStep.id === step.id }"
            type="button"
            @click="run(step)"
          >
            <span class="trail__mark" aria-hidden="true">{{ isDone(step.id) ? '✓' : index + 1 }}</span>
            <span class="trail__text">
              <span class="trail__step-title">
                {{ step.title }}
                <span class="trail__time">{{ step.minutes }}</span>
              </span>
              <span class="trail__desc">{{ step.desc }}</span>
            </span>
            <span class="trail__go" aria-hidden="true">›</span>
          </button>
        </li>
      </ol>
      <div class="trail__foot">
        <button class="trail__link" type="button" @click="reset">最初からやり直す</button>
        <button class="trail__link" type="button" @click="hide">閉じる</button>
      </div>
    </div>
  </section>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { auth } from '@/firebase';
  import { onAuthStateChanged } from 'firebase/auth';
  import { GUEST_TRAIL, TRAIL_KEY, trailProgress, nextTrailStep, markDone, normalizeDone } from '@/lib/guestTrail.js';

  const HIDE_KEY = 'settlo_guest_trail_hidden';
  const router = useRouter();
  const steps = GUEST_TRAIL;
  const isGuest = ref(false);
  const hidden = ref(false);
  const open = ref(true);
  const done = ref([]);

  // 保存が読めない端末（プライベートモード等）でも画面は出す
  const load = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても続ける */ }
  };

  const progress = computed(() => trailProgress(done.value));
  const finished = computed(() => progress.value.finished);
  const nextStep = computed(() => nextTrailStep(done.value));
  const isDone = (id) => done.value.includes(id);
  const show = computed(() => isGuest.value && !hidden.value);

  const run = (step) => {
    done.value = markDone(done.value, step.id);
    save(TRAIL_KEY, done.value);
    if (step.action === 'event') window.dispatchEvent(new CustomEvent(step.event));
    else router.push(step.to);
  };
  const reset = () => { done.value = []; save(TRAIL_KEY, []); };
  const hide = () => { hidden.value = true; save(HIDE_KEY, true); };

  onMounted(() => {
    done.value = normalizeDone(load(TRAIL_KEY, []));
    hidden.value = load(HIDE_KEY, false) === true;
    isGuest.value = auth.currentUser?.isAnonymous === true;
    onAuthStateChanged(auth, (user) => { isGuest.value = user?.isAnonymous === true; });
  });
</script>

<style scoped>
.trail { margin: 0 16px 14px; border: 1px solid var(--c-brand, #16a34a); border-radius: 16px; background: var(--c-surface, #fff); overflow: hidden; }
.trail__head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 14px; background: var(--c-brand-weak, #ecfdf5); border: 0; cursor: pointer; text-align: left; }
.trail__head-main { flex: 1; min-width: 0; }
.trail__title { display: block; font-size: 14px; font-weight: var(--fw-bold, 700); color: var(--c-brand-strong, #0f7a4d); }
.trail__sub { display: block; margin-top: 2px; font-size: 11px; line-height: 1.4; color: var(--c-text-sub, #475569); overflow-wrap: anywhere; }
.trail__count { flex-shrink: 0; font-size: 12px; font-weight: var(--fw-bold, 700); color: var(--c-brand-strong, #0f7a4d); font-variant-numeric: tabular-nums; }
.trail__chev { flex-shrink: 0; font-size: 14px; color: var(--c-text-sub, #475569); transition: transform 0.2s ease; }
.trail__chev.is-open { transform: rotate(180deg); }

.trail__body { padding: 4px 8px 8px; }
.trail__list { list-style: none; margin: 0; padding: 0; }
.trail__step { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 6px; background: none; border: 0; border-radius: 10px; cursor: pointer; text-align: left; }
.trail__step + .trail__step { border-top: 1px solid var(--c-line, #e2e8f0); }
.trail__list li + li .trail__step { border-top: 1px solid var(--c-line, #e2e8f0); }
.trail__mark { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--c-surface-2, #f1f5f9); color: var(--c-text-sub, #475569); font-size: 12px; font-weight: var(--fw-bold, 700); }
.trail__step.is-done .trail__mark { background: #e3f3ea; color: #0f7a4d; }
.trail__step.is-next .trail__mark { background: var(--c-brand, #16a34a); color: #fff; }
.trail__text { flex: 1; min-width: 0; }
.trail__step-title { display: block; font-size: 13px; font-weight: var(--fw-bold, 700); color: var(--c-ink, #0f172a); line-height: 1.45; }
.trail__step.is-done .trail__step-title { color: var(--c-text-sub, #475569); }
.trail__time { margin-left: 6px; font-size: 10px; font-weight: 400; color: var(--c-text-sub, #475569); white-space: nowrap; }
.trail__desc { display: block; margin-top: 3px; font-size: 11px; line-height: 1.55; color: var(--c-text-sub, #475569); overflow-wrap: anywhere; }
.trail__go { flex-shrink: 0; align-self: center; color: var(--c-text-faint, #94a3b8); font-size: 15px; }
.trail__foot { display: flex; justify-content: flex-end; gap: 14px; padding: 6px 8px 2px; }
.trail__link { background: none; border: 0; padding: 4px; font-size: 11px; color: var(--c-text-sub, #475569); cursor: pointer; text-decoration: underline; }
.trail__step:focus-visible, .trail__head:focus-visible, .trail__link:focus-visible { outline: 2px solid var(--c-brand, #16a34a); outline-offset: 2px; }
</style>
