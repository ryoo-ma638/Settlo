<template>
  <div class="fcard" @click="$emit('click', user)">
    <div class="fcard__avatar">
      <img v-if="user.photo" :src="user.photo" class="fcard__img" />
      <div v-else class="fcard__ph" :style="{ backgroundColor: user.color || '#cbd5e1' }"></div>
    </div>

    <div class="fcard__info">
      <span class="fcard__name">{{ user.name }}</span>
      <div class="fcard__tags">
        <span v-if="!user.isFriend" class="chip chip--alert">未フレンド</span>
        <span v-if="user.isTrading" class="chip chip--brand">取引中</span>
        <span class="chip chip--muted">取引 {{ user.tradeCount }}回</span>
      </div>
    </div>

    <svg class="fcard__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
  </div>
</template>

<script setup>
defineProps({ user: Object });
defineEmits(['click']);
</script>

<style scoped>
.fcard {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--c-surface);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.fcard:active { transform: scale(0.985); }

.fcard__avatar { width: 48px; height: 48px; flex-shrink: 0; }
.fcard__img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.fcard__ph { width: 100%; height: 100%; border-radius: 50%; background: var(--c-line-bold); }

.fcard__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.fcard__name {
  font-size: 16px; font-weight: var(--fw-bold); color: var(--c-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fcard__tags { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { font-size: 10.5px; padding: 3px 9px; border-radius: var(--r-pill); font-weight: var(--fw-bold); }
.chip--alert { background: #fee2e2; color: var(--c-danger); }
.chip--brand { background: var(--c-brand-weak); color: var(--c-brand-strong); }
.chip--muted { background: var(--c-surface-2); color: var(--c-text-sub); }

.fcard__chevron {
  width: 20px; height: 20px; flex-shrink: 0;
  fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
</style>
