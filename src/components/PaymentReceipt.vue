<template>
    <div class="receipt-card">
      <div class="receipt-row"><span>イベント</span><strong>{{ item.eventName || '未設定' }}</strong></div>
      <div class="receipt-row"><span>お相手</span><strong>{{ item.name }}</strong></div>
      <div class="receipt-row"><span>立替え内容</span><strong>{{ item.itemName }}</strong></div>
      <div class="receipt-row"><span>日付</span><strong>{{ item.date }}</strong></div>
      <hr class="divider" />
      <p class="items-label">メモ・内訳</p>
      <ul class="items-list">
        <li v-for="(thing, idx) in item.itemsDetail" :key="idx">{{ thing }}</li>
      </ul>
    </div>
  </template>
  
  <script setup>
  defineProps({ item: Object });
  </script>
  
  <style scoped>
  .receipt-card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .receipt-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
  .receipt-row span { color: #64748b; }
  .divider { border: none; border-top: 1px dashed #e2e8f0; margin: 15px 0; }
  .items-label { font-size: 13px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-align: left; }
  .items-list { padding-left: 20px; text-align: left; font-size: 14px; color: #1e293b; list-style: disc; }
  </style>