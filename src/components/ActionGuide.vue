<template>
  <!-- お支払いアシスタント：今の状態から「次にやること」を指示する（ルールベース） -->
  <section class="guide">
    <div class="guide__head">
      <span class="guide__bot">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M8 3h8" />
          <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <div class="guide__titles">
        <p class="guide__title">お支払いアシスタント</p>
        <p class="guide__sub">{{ actions.length ? '次にやることがあります' : 'いまやることはありません' }}</p>
      </div>
    </div>

    <div v-if="actions.length" class="guide__list">
      <div v-for="(a, i) in actions.slice(0, 3)" :key="i" class="gact">
        <span class="gact__ic" :class="'gact__ic--' + a.kind">
          <svg v-if="a.kind === 'approve'" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
          <svg v-else-if="a.kind === 'pay'" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        </span>
        <span class="gact__text">{{ a.text }}</span>
        <button class="gact__btn" @click="$router.push(a.to)">{{ a.cta }}</button>
      </div>
      <p v-if="actions.length > 3" class="guide__more">ほか {{ actions.length - 3 }} 件あります</p>
    </div>
    <p v-else class="guide__done">すべて精算できています。いい感じです。</p>
  </section>
</template>

<script setup>
// actions: [{ kind: 'approve'|'pay'|'remind', text, cta, to }]
defineProps({ actions: { type: Array, default: () => [] } });
</script>

<style scoped>
.guide {
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  margin: 12px var(--pad) 4px;
  box-shadow: var(--shadow-card);
}
.guide__head { display: flex; align-items: center; gap: 10px; }
.guide__bot {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px;
  background: var(--c-brand-weak); color: var(--c-brand);
  display: flex; align-items: center; justify-content: center;
}
.guide__bot svg { width: 24px; height: 24px; }
.guide__title { font-size: 14px; font-weight: var(--fw-black); color: var(--c-ink); }
.guide__sub { font-size: 12px; color: var(--c-text-sub); }

.guide__list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.gact { display: flex; align-items: center; gap: 10px; }
.gact__ic {
  width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
}
.gact__ic svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.gact__ic--approve { background: var(--c-brand-weak); color: var(--c-brand-strong); }
.gact__ic--pay { background: #fff7ed; color: var(--c-pay-strong); }
.gact__ic--remind { background: #eff6ff; color: var(--c-receive); }
.gact__text { flex: 1; min-width: 0; font-size: 13px; font-weight: var(--fw-medium); color: var(--c-text); line-height: 1.5; }
.gact__btn {
  flex-shrink: 0; padding: 8px 14px; border-radius: var(--r-pill);
  background: var(--c-brand); color: #fff; font-size: 12.5px; font-weight: var(--fw-black);
}
.gact__btn:active { transform: scale(0.96); background: var(--c-brand-strong); }
.guide__more { font-size: 12px; color: var(--c-text-faint); font-weight: var(--fw-bold); margin-top: 2px; }
.guide__done { margin-top: 10px; font-size: 13px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
</style>
