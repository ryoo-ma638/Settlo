<template>
  <!-- データ待ちの間だけ表示する行プレースホルダー（アバター＋2行＋右の金額） -->
  <div class="skrows" aria-hidden="true">
    <div v-for="n in rows" :key="n" class="skrow">
      <div class="skeleton skeleton--circle skrow__avatar"></div>
      <div class="skrow__lines">
        <div class="skeleton skeleton--text skrow__l1"></div>
        <div class="skeleton skeleton--text skrow__l2"></div>
      </div>
      <div v-if="amount" class="skeleton skeleton--text skrow__amt"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 3 },   // 表示する行数
  amount: { type: Boolean, default: true }, // 右端に金額プレースホルダーを出すか
});
</script>

<style scoped>
.skrow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px var(--pad);
  border-bottom: 1px solid var(--c-line);
}
.skrow__avatar { width: 40px; height: 40px; flex-shrink: 0; }
.skrow__lines { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.skrow__l1 { width: 55%; }
.skrow__l2 { width: 32%; height: 10px; }
.skrow__amt { width: 64px; height: 16px; flex-shrink: 0; }
</style>
