<template>
  <!--
    未読の件数を出す赤バッジ。表示ルールはこの1ファイルに集約している。
    ・count が 1 以上のとき、赤い丸に件数を表示（99 超は 99+）。
    ・後で「1件は赤丸・2件以上だけ数字」に切り替えたい場合は、下の DOT_MODE を true にするだけ。
    位置は親側の position:relative な要素を基準に、右上へ重ねる。
  -->
  <span v-if="count > 0" class="notif-badge" :class="{ 'notif-badge--dot': isDot }">
    <template v-if="!isDot">{{ label }}</template>
  </span>
</template>

<script setup>
import { computed } from 'vue';

// 表示方式の切り替えはここ1行だけ。
// false = つねに件数の数字を出す（録画で件数がはっきり見える）
// true  = 1件は赤丸のみ・2件以上は数字
const DOT_MODE = false;

const props = defineProps({
  count: { type: Number, default: 0 },
});

const isDot = computed(() => DOT_MODE && props.count === 1);
const label = computed(() => (props.count > 99 ? '99+' : props.count));
</script>

<style scoped>
.notif-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--c-danger);
  color: #fff;
  font-size: 10px;
  font-weight: var(--fw-black);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  pointer-events: none;
}
/* 赤丸モード（1件のとき）用。数字は出さず点だけにする。 */
.notif-badge--dot {
  min-width: 9px;
  width: 9px;
  height: 9px;
  padding: 0;
  border: 2px solid var(--c-surface);
}
</style>
