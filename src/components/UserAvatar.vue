<template>
  <span class="uavatar" :style="rootStyle">
    <img v-if="photo" :src="photo" alt="" class="uavatar__img" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup>
/*
  アバターの共通部品。
  写真があれば写真、無ければ「名前の頭文字1字＋名前から決まる背景色」を描く。
  大きさは size（円の直径px）で指定する。文字の大きさもそこから決まる。
  親から class / style を渡すと重ね表示（margin-left や z-index）もそのまま効く。
*/
import { computed } from 'vue';
import { avatarColor, avatarInitial } from '@/lib/avatar';

const props = defineProps({
  name:  { type: String, default: '' },
  photo: { type: String, default: '' },
  size:  { type: [Number, String], default: 40 },
});

const px = computed(() => Number(props.size) || 40);
const initial = computed(() => avatarInitial(props.name));

const rootStyle = computed(() => ({
  width: `${px.value}px`,
  height: `${px.value}px`,
  fontSize: `${Math.max(11, Math.round(px.value * 0.42))}px`,
  background: props.photo ? 'transparent' : avatarColor(props.name),
}));
</script>

<style scoped>
.uavatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: var(--fw-black);
  line-height: 1;
  letter-spacing: 0;
  user-select: none;
}
.uavatar__img { width: 100%; height: 100%; object-fit: cover; display: block; }
</style>
