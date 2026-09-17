<script setup>
import { computed } from 'vue'
import { getBatchCardState } from '../lib/batchStates.js'
const props = defineProps({
  number: { type: Number, required: true },
  store: { type: String, default: '' },
  amount: { type: String, default: '' },
  date: { type: String, default: '' },
  state: { type: String, required: true },
  reasonText: { type: String, default: '' },
  receipt: { type: Object, default: null },
  image: { type: String, default: '' },
})
const emit = defineEmits(['update:store', 'update:amount', 'update:date', 'remove', 'restore'])
const spec = computed(() => getBatchCardState(props.state))
const editable = computed(() => spec.value.canEditAmount)
</script>

<template>
  <article class="receipt-card" :class="`tone-${spec.tone}`">
    <div class="receipt-head">
      <span class="receipt-number">{{ number }}枚目 ・ 1. レシート内容</span>
      <span class="receipt-state">{{ spec.label }}</span>
    </div>
    <label class="receipt-field">店名・内容
      <input v-if="editable" type="text" maxlength="60" :value="store" placeholder="店名を確認"
        @input="emit('update:store', $event.target.value)">
      <b v-else class="receipt-store">{{ store.trim() || '店名なし' }}</b>
    </label>
    <label class="receipt-field receipt-amount">金額（円）
      <input v-if="editable" type="text" inputmode="numeric" pattern="[0-9]*" :value="amount"
        placeholder="金額を入力" @input="emit('update:amount', $event.target.value)">
      <b v-else>{{ amount && /^\d+$/.test(amount) ? Number(amount).toLocaleString('ja-JP') : (amount || '未入力') }}</b>
    </label>
    <label class="receipt-field">日付
      <input v-if="editable" type="date" :value="date" @input="emit('update:date', $event.target.value)">
      <b v-else>{{ date || '日付なし' }}</b>
    </label>
    <p v-if="reasonText" class="receipt-reason" role="status">{{ reasonText }}</p>
    <details v-if="image" class="receipt-details">
      <summary>写真を確認</summary>
      <img :src="image" alt="このレシートの元画像" class="receipt-image">
    </details>
    <details v-if="receipt" class="receipt-details">
      <summary>読み取り詳細（明細{{ receipt.items.length }}件）</summary>
      <dl class="receipt-meta">
        <dt>読み取った店名</dt><dd>{{ receipt.storeName || '不明' }}</dd>
        <dt>読み取った日付</dt><dd>{{ receipt.date || '不明' }}</dd>
        <dt>時刻</dt><dd>{{ receipt.time || '不明' }}</dd>
        <dt>通貨</dt><dd>{{ receipt.currency || '不明' }}</dd>
        <dt>読み取った合計</dt><dd>{{ receipt.totalAmount == null ? '不明' : receipt.totalAmount.toLocaleString() }}</dd>
        <dt>ポイント利用</dt><dd>{{ receipt.pointsUsed == null ? '記載なし・不明' : receipt.pointsUsed.toLocaleString() }}</dd>
        <dt>明細の価格</dt><dd>{{ receipt.taxIncluded === true ? '税込' : receipt.taxIncluded === false ? '税抜' : '不明' }}</dd>
        <dt>登録番号</dt><dd>{{ receipt.registrationNumber || '記載なし・不明' }}</dd>
      </dl>
      <p class="receipt-reason">写真から読み取った内容です。登録する合計・日付は上の入力欄、立替者と割り方は続く精算欄で確認してください。</p>
      <ul v-if="receipt.items.length" class="receipt-items">
        <li v-for="(item, index) in receipt.items" :key="index">
          <strong>{{ item.name || '品目名不明' }}</strong>
          <span>行の合計 {{ item.lineTotal == null ? '不明' : item.lineTotal.toLocaleString() }} / 数量 {{ item.quantity ?? '不明' }} / 税率 {{ item.taxRate == null ? '不明' : item.taxRate + '%' }}</span>
        </li>
      </ul>
      <p v-else class="receipt-reason">明細は読み取れていません。</p>
    </details>
    <div class="receipt-actions">
      <button v-if="spec.canExclude" type="button" class="receipt-remove" @click="emit('remove')">登録から除外</button>
      <button v-if="spec.canRestore" type="button" class="receipt-restore" @click="emit('restore')">登録対象に戻す</button>
    </div>
  </article>
</template>

<style scoped>
.receipt-card { min-width: 0; padding: 16px; background: var(--c-surface, #fff); border: 1px solid var(--c-line-bold, #dfe5e8); border-radius: 20px; color: var(--c-text, #22303b); box-shadow: 0 4px 14px rgba(31, 51, 64, .05); }
.receipt-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-bold, #dfe5e8); }
.receipt-number { font-size: 14px; font-weight: 900; }
.receipt-state { padding: 5px 9px; border-radius: 999px; background: var(--c-surface-2, #f4f7f9); font-size: 11px; font-weight: 800; }
.receipt-field { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; color: var(--c-text-sub, #52616c); font-size: 12px; font-weight: 700; }
.receipt-field input { width: 100%; min-width: 0; min-height: 46px; box-sizing: border-box; border: 1px solid var(--c-line-bold, #dfe5e8); border-radius: 12px; padding: 10px 12px; background: var(--c-surface-2, #f4f7f9); color: var(--c-text, #22303b); font-size: 16px; font-weight: 800; }
.receipt-field input:focus { outline: 2px solid var(--c-brand, #059669); outline-offset: 2px; background: white; }
.receipt-field b { color: var(--c-text, #22303b); font-size: 16px; overflow-wrap: anywhere; }
.receipt-amount input, .receipt-amount b { font-size: 26px; font-weight: 900; }
.receipt-store { line-height: 1.5; }
.receipt-reason { margin: 12px 0 0; padding: 10px 12px; border-radius: 12px; background: var(--c-surface-2, #f4f7f9); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }
.receipt-details { margin: 12px 0; font-size: 13px; }
.receipt-details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
.receipt-image { display: block; width: 100%; height: auto; margin: 8px 0; }
.receipt-meta { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 8px; line-height: 1.6; }
.receipt-meta dt, .receipt-meta dd { margin: 0; overflow-wrap: anywhere; }
.receipt-meta dt { color: var(--c-text-sub, #52616c); }
.receipt-items { list-style: none; padding: 0; margin: 0; }
.receipt-items li { padding: 10px 0; border-top: 1px solid var(--c-line-bold, #dfe5e8); overflow-wrap: anywhere; }
.receipt-items strong, .receipt-items span { display: block; line-height: 1.6; }
.receipt-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
.receipt-actions button { min-height: 44px; border: 1.5px solid; border-radius: 12px; padding: 10px 16px; font-size: 14px; font-weight: 900; cursor: pointer; transition: transform .16s ease, background .16s ease; }
.receipt-actions button:active { transform: scale(.97); }
.receipt-remove { border-color: #fecaca; background: var(--c-danger-weak, #fef2f2); color: var(--c-danger-strong, #b91c1c); }
.receipt-restore { border-color: var(--c-brand, #059669); background: var(--c-brand-weak, #ecfdf5); color: var(--c-brand-strong, #047857); }
.tone-warn .receipt-state, .tone-danger .receipt-state { color: var(--c-pay-strong, #a65c00); }
.tone-done .receipt-state, .tone-ok .receipt-state { color: var(--c-brand, #059669); }
.tone-muted { opacity: .7; }
</style>
