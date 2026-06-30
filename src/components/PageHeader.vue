<template>
  <header class="pagehead">
    <button v-if="showBack" class="pagehead__back" @click="goBack" aria-label="戻る">
      <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>
    </button>
    <span v-else class="pagehead__spacer"></span>

    <h2 class="pagehead__title">{{ title }}</h2>

    <div class="pagehead__right">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router';

const props = defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: true },
  fallback: { type: String, default: '/' },
});

const router = useRouter();
const goBack = () => {
  if (window.history.length > 1) router.back();
  else router.push(props.fallback);
};
</script>

<style scoped>
.pagehead {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  padding: 12px 12px;
  background: var(--c-bg);
}

.pagehead__back {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.15s ease;
}
.pagehead__back:active { background: var(--c-line); }
.pagehead__back svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--c-ink);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pagehead__spacer { width: 40px; }

.pagehead__title {
  text-align: center;
  font-size: 17px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
}

.pagehead__right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
