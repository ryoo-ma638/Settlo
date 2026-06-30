<template>
  <svg viewBox="0 0 24 24" class="genre-icon" aria-hidden="true">
    <!-- 食事 -->
    <g v-if="type === '食事'">
      <path d="M6 3v6M9 3v6M7.5 9v12M7.5 9a1.5 1.5 0 0 1-1.5-1.5M7.5 9a1.5 1.5 0 0 0 1.5-1.5" />
      <path d="M16.5 3c-1.6 0-2.5 2-2.5 4.5 0 2 1 3.5 2 3.5l-.5 10" />
    </g>
    <!-- 旅行 -->
    <g v-else-if="type === '旅行'">
      <path d="M21 14.5 14 12V5.5a2 2 0 0 0-4 0V12l-7 2.5V17l7-1.8V19l-2 1.4V22l4-1 4 1v-1.6L14 19v-3.8l7 1.8z" />
    </g>
    <!-- 遊び -->
    <g v-else-if="type === '遊び'">
      <rect x="3" y="7" width="18" height="10" rx="2.5" />
      <path d="M14.5 7v10" stroke-dasharray="1.5 2.2" />
    </g>
    <!-- 買い物 -->
    <g v-else-if="type === '買い物'">
      <circle cx="9.5" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
      <path d="M3 4h2l2.1 10.4a1.5 1.5 0 0 0 1.5 1.2h8a1.5 1.5 0 0 0 1.5-1.2L20.5 7.5H6.2" />
    </g>
    <!-- 飲み会 -->
    <g v-else-if="type === '飲み会'">
      <path d="M7 4h8v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <path d="M15 7h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M7 9h8" />
    </g>
    <!-- その他 -->
    <g v-else>
      <circle cx="5.5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.5" cy="12" r="1.4" />
    </g>
  </svg>
</template>

<script setup>
defineProps({ type: { type: String, default: 'その他' } });
</script>

<style scoped>
.genre-icon {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
