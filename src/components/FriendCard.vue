<template>
  <button type="button" class="fcard" @click="$emit('click', user)">
    <div class="fcard__main">
      <UserAvatar class="fcard__avatar" :name="user.name" :photo="user.photo" :size="44" />
      <div class="fcard__info">
        <span class="fcard__name">{{ user.name }}</span>
        <span class="fcard__relationship">{{ user.isFriend ? 'フレンド' : '未フレンド' }}<span v-if="user.isTrading">・取引中</span></span>
      </div>
      <span v-if="user.tradeCountState === 'ready' && user.net" class="fcard__bal" :class="user.net < 0 ? 'is-pay' : 'is-receive'">
        {{ user.net < 0 ? '支払う' : '受け取る' }}
        <span class="fcard__bal-amt">¥{{ Math.abs(user.net).toLocaleString() }}</span>
      </span>
      <span v-else-if="user.settlement?.unsettled && user.tradeCountState === 'ready'" class="fcard__bal fcard__bal--neutral">
        差し引き<span class="fcard__bal-amt">¥0</span>
      </span>
      <svg class="fcard__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </div>

    <div class="fcard__summary">
      <template v-if="user.tradeCount != null">
        <span class="fcard__count">取引 <strong>{{ user.tradeCount }}</strong>回</span>
        <span v-if="user.settlement?.unsettled" class="fcard__unsettled">未精算 <strong>{{ user.settlement.unsettled }}</strong>件</span>
        <span v-else-if="user.tradeCount > 0" class="fcard__settled"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>精算済み</span>
        <span v-else class="fcard__settled">取引はまだありません</span>
      </template>
      <span v-else class="fcard__count">{{ user.tradeCountState === 'error' ? '取引を取得できません' : '取引を確認中' }}</span>
    </div>

    <div v-if="user.settlement?.myConfirmation || user.settlement?.theirConfirmation" class="fcard__pending" title="確認待ちの件数は、未精算の明細数の内訳です">
      <span v-if="user.settlement.myConfirmation" class="fcard__pending-own"><svg class="fcard__status-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="m5 8 2 2 4-4"/></svg>自分の受取確認 <strong>{{ user.settlement.myConfirmation }}件</strong></span>
      <span v-if="user.settlement.theirConfirmation" class="fcard__pending-other"><svg class="fcard__status-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>相手の確認待ち <strong>{{ user.settlement.theirConfirmation }}件</strong></span>
    </div>
  </button>
</template>

<script setup>
import UserAvatar from './UserAvatar.vue';
defineProps({ user: Object });
defineEmits(['click']);
</script>

<style scoped>
.fcard {
  display: block; width: 100%; text-align: left; font: inherit;
  background: var(--c-surface); color: var(--c-ink);
  border: 1px solid var(--c-line); border-radius: var(--r-lg);
  padding: 16px; cursor: pointer; touch-action: manipulation;
  box-shadow: 0 2px 5px rgb(15 23 42 / 3%);
}
.fcard:active { background: var(--c-surface-2); }
.fcard:focus-visible { outline: 2px solid var(--c-brand); outline-offset: 3px; }
.fcard__main { display: flex; align-items: center; gap: 12px; }
.fcard__avatar { flex-shrink: 0; }
.fcard__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.fcard__name { font-size: 16px; font-weight: var(--fw-bold); line-height: 1.4; overflow-wrap: anywhere; }
.fcard__relationship { font-size: 11px; color: var(--c-text-sub); line-height: 1.4; }
.fcard__bal { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; font-size: 11px; font-weight: var(--fw-bold); }
.fcard__bal.is-pay { color: #b45309; }
.fcard__bal.is-receive { color: var(--c-receive); }
.fcard__bal--neutral { color: var(--c-text-sub); }
.fcard__bal-amt { font-size: 19px; line-height: 1.2; font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.fcard__chevron { width: 14px; height: 18px; flex-shrink: 0; fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fcard__summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 14px; font-size: 12px; line-height: 1.5; }
.fcard__count { color: var(--c-text-sub); }
.fcard__count strong { font-weight: 600; }
.fcard__unsettled { color: var(--c-ink); }
.fcard__unsettled::before { content: ''; display: inline-block; height: 10px; border-left: 1px solid var(--c-line-bold); margin-right: 14px; }
.fcard__settled { color: var(--c-text-sub); display: inline-flex; align-items: center; gap: 4px; }
.fcard__settled svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.fcard__pending { border-top: 1px solid var(--c-line); margin-top: 12px; padding-top: 11px; display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; line-height: 1.5; }
.fcard__pending > span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 0; }
.fcard__pending > .fcard__pending-own { color: #065f46; background: #ecfdf5; border-left: 2px solid #059669; border-radius: 0 4px 4px 0; padding: 5px 8px; font-weight: 600; }
.fcard__pending-other { color: var(--c-text-sub); }
.fcard__status-icon { width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 360px) {
  .fcard { padding: 14px 12px; }
  .fcard__main { gap: 8px; }
  .fcard__bal-amt { font-size: 17px; }
}
</style>
