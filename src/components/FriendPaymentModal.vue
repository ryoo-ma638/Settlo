<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="modal-content slide-up">
        <div class="fp__head">
          <h3 class="fp__title">{{ friendName }}さんと割り勘</h3>
          <button class="fp__close" aria-label="閉じる" @click="close">×</button>
        </div>

        <p class="fp__note">イベントを作らずに、この人との立て替えを1件だけ記録します。</p>

        <label class="fp__label" for="fp-item">何の支払いですか</label>
        <input id="fp-item" v-model="itemName" class="fp__input" type="text" maxlength="60" placeholder="例：ランチ代" />

        <label class="fp__label" for="fp-total">合計金額</label>
        <input id="fp-total" v-model="total" class="fp__input" type="text" inputmode="numeric" placeholder="例：3000" />

        <p class="fp__label">立て替えたのは</p>
        <div class="fp__row">
          <button class="fp__chip" :class="{ 'is-on': iPaid }" @click="iPaid = true">自分</button>
          <button class="fp__chip" :class="{ 'is-on': !iPaid }" @click="iPaid = false">{{ friendName }}さん</button>
        </div>

        <p class="fp__label">割り方</p>
        <div class="fp__row">
          <button v-for="(name, key) in SPLIT_MODES" :key="key" class="fp__chip"
            :class="{ 'is-on': mode === key }" @click="mode = key">{{ name }}</button>
        </div>

        <template v-if="mode === 'custom'">
          <label class="fp__label" for="fp-custom">{{ debtorLabel }}の負担額</label>
          <input id="fp-custom" v-model="customAmount" class="fp__input" type="text" inputmode="numeric" placeholder="例：1200" />
        </template>

        <p v-if="preview" class="fp__preview">{{ preview }}</p>
        <p v-if="error" class="fp__error" role="alert">{{ error }}</p>

        <button class="fp__save" data-tour="fp-save" :disabled="saving" @click="save">
          {{ saving ? '保存しています…' : 'この内容で記録する' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { markTrailDone } from '@/lib/trailProgressSignal.js';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { SPLIT_MODES, SPLIT_ERRORS, buildDirectTransaction, debtorAmountOf } from '@/lib/directSplit';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  friendName: { type: String, default: '相手' },
  friendUid: { type: String, default: '' },
});
const emit = defineEmits(['close', 'saved']);

const itemName = ref('');
const total = ref('');
const customAmount = ref('');
const mode = ref('half');
const iPaid = ref(true);
const saving = ref(false);
const error = ref('');

// 開くたびに入力を空へ戻す（前の内容が残っていると誤って保存される）
watch(() => props.isOpen, (open) => {
  if (!open) return;
  itemName.value = ''; total.value = ''; customAmount.value = '';
  mode.value = 'half'; iPaid.value = true; error.value = ''; saving.value = false;
});

// 「自分さん」にならないよう、自分のときだけ さん を付けない
const nameOf = (isMe) => (isMe ? '自分' : `${props.friendName}さん`);
const debtorLabel = computed(() => nameOf(!iPaid.value));

// 保存する前に、いくらの記録になるかを見せる
const preview = computed(() => {
  const r = debtorAmountOf({ total: total.value, mode: mode.value, customAmount: customAmount.value });
  if (!r.ok) return '';
  return `${nameOf(!iPaid.value)}が${nameOf(iPaid.value)}へ ¥${r.amount.toLocaleString()} を支払う記録になります。`;
});

const close = () => { if (!saving.value) emit('close'); };

const save = async () => {
  if (saving.value) return;
  error.value = '';
  const myUid = auth.currentUser?.uid || '';
  const built = buildDirectTransaction({
    total: total.value, mode: mode.value, customAmount: customAmount.value,
    itemName: itemName.value, myUid, friendUid: props.friendUid, iPaid: iPaid.value,
  });
  if (!built.ok) { error.value = SPLIT_ERRORS[built.reason] || '入力を確認してください。'; return; }
  if (built.transaction.amount === 0) { error.value = '相手の負担が0円になります。金額か割り方を見直してください。'; return; }

  saving.value = true;
  try {
    await addDoc(collection(db, 'transactions'), { ...built.transaction, createdAt: serverTimestamp() });
    markTrailDone('split'); // お試しの案内へ「やってみた」と伝える
    emit('saved');
    emit('close');
  } catch (e) {
    console.error('割り勘の記録に失敗:', e);
    error.value = '保存できませんでした。電波状況を確認して、もう一度お試しください。';
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: var(--c-overlay); display: flex; align-items: flex-end; justify-content: center; z-index: 3000; backdrop-filter: blur(4px);  padding-bottom: var(--frame-inset-y);}
.modal-content { background: var(--c-surface-2); width: 100%; max-width: min(600px, var(--app-max)); border-radius: 32px 32px 0 0; padding: 24px 22px 28px; box-sizing: border-box; max-height: 88vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }

.fp__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fp__title { margin: 0; font-size: 17px; font-weight: var(--fw-bold); }
.fp__close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--c-surface); font-size: 20px; line-height: 1; cursor: pointer; }
.fp__note { margin: 6px 0 16px; font-size: 12px; line-height: 1.6; color: var(--c-text-sub); }

.fp__label { margin: 14px 0 6px; font-size: 12.5px; font-weight: var(--fw-bold); color: var(--c-text); }
.fp__input { width: 100%; padding: 12px; border: 1px solid var(--c-line); border-radius: 12px; background: var(--c-surface); font-size: 16px; box-sizing: border-box; }
.fp__row { display: flex; flex-wrap: wrap; gap: 8px; }
.fp__chip { padding: 9px 14px; border: 1px solid var(--c-line); border-radius: var(--r-pill, 999px); background: var(--c-surface); font-size: 13px; cursor: pointer; }
.fp__chip.is-on { border-color: var(--c-brand); background: var(--c-brand-weak, #eaf5ee); color: var(--c-brand); font-weight: var(--fw-bold); }

.fp__preview { margin: 16px 0 0; padding: 11px 12px; border-radius: 12px; background: var(--c-surface); font-size: 12.5px; line-height: 1.6; color: var(--c-text); }
.fp__error { margin: 10px 0 0; font-size: 12.5px; line-height: 1.6; color: var(--c-danger-strong, #b91c1c); }
.fp__save { width: 100%; margin-top: 18px; padding: 14px; border: 0; border-radius: 14px; background: var(--c-brand); color: #fff; font-size: 15px; font-weight: var(--fw-bold); cursor: pointer; }
.fp__save:disabled { opacity: 0.55; cursor: default; }
</style>
