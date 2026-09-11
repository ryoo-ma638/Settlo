<script setup>
/**
 * 結果カードの「仮」部品（結合作業用）。
 *
 * 本物は `ReceiptResultCard.vue` として別の人が作ります。このファイルはその名前を
 * 空けておくための置き換え用で、**本物が届いたら使わなくなります**。
 * ここでは props / emits の受け渡しが正しいことだけを確かめられれば十分なので、
 * 見た目は最低限です。
 *
 * 契約（本物のカードもこれに合わせます）
 * - props : store / amount / date / state / reasonText
 * - emits : update:amount（文字列）/ remove（引数なし）/ restore（引数なし）
 * - `amount` は**文字列**です。編集中の値をそのまま持ちます。空文字は空文字のまま返し、
 *   子の側で 0 や整数に丸めません。保存できる数値への検証と変換は親が行います。
 * - `state` は書き換えません。除外や復帰は emit で親に頼み、親が新しい state を配ります。
 * - 再送（retry）はカードに作りません。保存失敗・応答不明のカードをもう一度送るのは
 *   親のボタンの仕事です。
 * - Firebase・router・他の画面には一切触りません。
 */
import { computed } from 'vue'
import { BATCH_CARD_STATE_ORDER, getBatchCardState } from '../lib/batchStates'

const props = defineProps({
  /** 店名（表示用の文字列）。空のときは「店名なし」と出す。 */
  store: { type: String, default: '' },
  /** 金額（**文字列**）。空文字は空のまま。丸めない。 */
  amount: { type: String, default: '' },
  /** 日付（表示用の文字列）。整形は親が行う。空のときは「日付なし」と出す。 */
  date: { type: String, default: '' },
  /** カードの状態。`src/lib/batchStates.js` の9状態のいずれか。 */
  state: {
    type: String,
    required: true,
    validator: (v) => BATCH_CARD_STATE_ORDER.includes(v),
  },
  /** 要確認・失敗の理由（任意）。金額／日付／通信のどれが原因かを親が文章で渡す。 */
  reasonText: { type: String, default: '' },
})

const emit = defineEmits({
  /** 金額が変わった。必ず文字列で返す。 */
  'update:amount': (value) => typeof value === 'string',
  /** 除外したい。 */
  remove: () => true,
  /** 除外から戻したい。 */
  restore: () => true,
})

const spec = computed(() => getBatchCardState(props.state))

const storeText = computed(() => (props.store.trim() ? props.store : '店名なし'))
const dateText = computed(() => (props.date.trim() ? props.date : '日付なし'))

/** 読み取り専用のときの金額表示。数字だけなら3桁区切りにするが、値は変えない。 */
const amountText = computed(() => {
  const raw = props.amount
  if (!raw) return '未入力'
  return /^\d+$/.test(raw) ? `¥${Number(raw).toLocaleString('ja-JP')}` : raw
})

const onAmountInput = (event) => {
  emit('update:amount', event.target.value)
}
</script>

<template>
  <div class="stub-card" :class="`is-${spec.tone}`">
    <div class="stub-card__head">
      <p class="stub-card__store" :class="{ 'is-empty': !store.trim() }">{{ storeText }}</p>
      <span class="stub-card__badge">{{ spec.label }}</span>
    </div>

    <div class="stub-card__amount-row">
      <input
        v-if="spec.canEditAmount"
        class="stub-card__amount-input"
        type="text"
        inputmode="numeric"
        :value="amount"
        aria-label="金額"
        @input="onAmountInput"
      >
      <p v-else class="stub-card__amount-text tnum">{{ amountText }}</p>
    </div>

    <p class="stub-card__date" :class="{ 'is-empty': !date.trim() }">{{ dateText }}</p>

    <p v-if="reasonText" class="stub-card__reason">{{ reasonText }}</p>

    <div class="stub-card__actions">
      <button v-if="spec.canExclude" type="button" class="stub-card__btn" @click="emit('remove')">
        除外する
      </button>
      <button v-if="spec.canRestore" type="button" class="stub-card__btn" @click="emit('restore')">
        戻す
      </button>
      <span v-if="!spec.canExclude && !spec.canRestore" class="stub-card__locked">操作できません</span>
    </div>

    <p class="stub-card__note">仮のカードです（本物は ReceiptResultCard.vue）</p>
  </div>
</template>

<style scoped>
/* 文字サイズについて
   `base.css` には文字サイズのトークンがありません（あるのは色・余白・角丸・太さ）。
   そこでこのカードの中だけで4段階に決め、下の変数からだけ引きます。
   本物のカードも、この4段階に合わせてください（段階を増やさない）。
     --card-fs-amount  22px : 金額（いちばん大きい）
     --card-fs-title   15px : 店名
     --card-fs-body    14px : ボタン・本文
     --card-fs-caption 12px : 日付・理由・状態の札
   入力欄だけは base.css が 16px を指定しています（iOSの自動ズーム防止）。
   16px より小さくしないでください。金額の入力欄は 22px なので問題ありません。 */
.stub-card {
  --card-fs-amount: 22px;
  --card-fs-title: 15px;
  --card-fs-body: 14px;
  --card-fs-caption: 12px;

  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  border-left: 4px solid var(--c-line-strong);
  border-radius: var(--r-md);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  box-shadow: var(--shadow-sm);
}

/* 状態ごとの色。左の縁と札の色だけ変える（仮なので最小限） */
.stub-card.is-ok { border-left-color: var(--c-brand); }
.stub-card.is-warn { border-left-color: var(--c-pay-strong); }
.stub-card.is-danger { border-left-color: var(--c-danger); }
.stub-card.is-busy { border-left-color: var(--c-receive); }
.stub-card.is-done { border-left-color: var(--c-brand-deep); }
.stub-card.is-muted { border-left-color: var(--c-line-strong); opacity: 0.6; }

.stub-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.stub-card__store {
  font-size: var(--card-fs-title);
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  overflow-wrap: anywhere;
}
.stub-card__store.is-empty { color: var(--c-text-faint); font-weight: var(--fw-medium); }

.stub-card__badge {
  flex-shrink: 0;
  font-size: var(--card-fs-caption);
  font-weight: var(--fw-bold);
  color: var(--c-text-strong);
  background: var(--c-surface-2);
  border-radius: var(--r-pill);
  padding: 2px var(--space-2);
  white-space: nowrap;
}

.stub-card__amount-row { min-width: 0; }
.stub-card__amount-input {
  width: 100%;
  font-size: var(--card-fs-amount);
  font-weight: var(--fw-heavy);
  color: var(--c-ink);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-sm);
  padding: var(--space-2) var(--space-3);
}
.stub-card__amount-text {
  font-size: var(--card-fs-amount);
  font-weight: var(--fw-heavy);
  color: var(--c-ink);
  overflow-wrap: anywhere;
}

.stub-card__date {
  font-size: var(--card-fs-caption);
  color: var(--c-text-sub);
}
.stub-card__date.is-empty { color: var(--c-text-faint); }

.stub-card__reason {
  font-size: var(--card-fs-caption);
  line-height: 1.6;
  color: var(--c-text-strong);
  background: var(--c-surface-2);
  border-radius: var(--r-sm);
  padding: var(--space-2);
}

.stub-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.stub-card__btn {
  font-size: var(--card-fs-body);
  font-weight: var(--fw-bold);
  color: var(--c-text-strong);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-pill);
  padding: var(--space-1) var(--space-3);
}
.stub-card__locked {
  font-size: var(--card-fs-caption);
  color: var(--c-text-faint);
}

.stub-card__note {
  font-size: var(--card-fs-caption);
  color: var(--c-text-faint);
}
</style>
