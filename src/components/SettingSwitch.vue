<template>
  <label class="row">
    <span class="row__copy"><strong>{{ label }}</strong><small>{{ description }}</small></span>
    <span class="switch">
      <input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)">
      <span aria-hidden="true"></span>
    </span>
  </label>
</template>
<script setup>
defineProps({ modelValue: Boolean, label: String, description: String, disabled: Boolean })
defineEmits(['update:modelValue'])
</script>
<style scoped>
.row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 0; border-bottom: 1px solid var(--c-line); }
.row:last-child { border-bottom: 0; padding-bottom: 0; }
.row__copy { min-width: 0; display: grid; gap: 4px; }
.row__copy strong { font-size: 14px; color: var(--c-ink); }
.row__copy small { font-size: 12px; line-height: 1.45; color: var(--c-text-sub); }
.switch { flex: 0 0 auto; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch > span { display: block; width: 44px; height: 26px; padding: 3px; border-radius: 999px; background: var(--c-line-bold); transition: .2s; }
.switch > span::after { content: ''; display: block; width: 20px; height: 20px; border-radius: 50%; background: white; box-shadow: var(--shadow-sm); transition: .2s; }
.switch input:checked + span { background: var(--c-brand); }
.switch input:checked + span::after { transform: translateX(18px); }
.switch input:disabled + span { background: var(--c-line-bold); }
.switch input:focus-visible + span { outline: 3px solid var(--c-brand-weak); outline-offset: 2px; }
</style>
