<!-- 相手に添えるひとことメッセージの共通入力部品（催促・招待・申請などで使い回す） -->
<template>
  <div class="msg-field">
    <label v-if="label" class="msg-field__label">{{ label }}</label>
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      class="msg-field__input"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
    ></textarea>
    <span class="msg-field__count">{{ (modelValue || '').length }}/{{ maxlength }}</span>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'ひとこと（任意）' },
  placeholder: { type: String, default: '相手に伝えたいことがあれば添えられます' },
  maxlength: { type: Number, default: 200 },
  rows: { type: Number, default: 2 },
});
defineEmits(['update:modelValue']);
</script>

<style scoped>
.msg-field { position: relative; }
.msg-field__label { display: block; font-size: 12px; font-weight: 900; color: var(--c-text-strong); margin-bottom: 8px; text-align: left; }
.msg-field__input {
  width: 100%; box-sizing: border-box;
  background: var(--c-surface);
  border: 1px solid var(--c-line-strong);
  border-radius: var(--r-md, 14px);
  padding: 12px 14px;
  font-size: 14px; font-weight: 600; color: var(--c-ink);
  font-family: inherit; resize: vertical; outline: none;
  transition: border-color 0.15s;
}
.msg-field__input::placeholder { color: var(--c-text-faint); font-weight: 500; }
.msg-field__input:focus { border-color: var(--c-brand); }
.msg-field__count { position: absolute; right: 4px; bottom: -18px; font-size: 11px; color: var(--c-text-faint); font-weight: 700; }
</style>
