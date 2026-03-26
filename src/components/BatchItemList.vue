<template>
    <section class="history-section">
      <h3 class="section-sub">まとめての内訳</h3>
      <div class="item-list">
        <div v-for="item in items" :key="item.id" class="item-row" @click="$emit('select', item)">
          <div class="item-info">
            <span class="row-date">{{ item.date }}</span>
            <span class="row-name">{{ item.itemName }}</span>
          </div>
          <div class="item-price">¥{{ item.amount.toLocaleString() }} ›</div>
        </div>
      </div>
    </section>
  </template>
  
  <script setup>
  defineProps({ items: Array });
  defineEmits(['select']);
  </script>
  
  <style scoped>
  .section-sub { font-size: 16px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; text-align: left; }
  .item-row { 
    background: white; padding: 15px; border-radius: 16px; margin-bottom: 10px;
    display: flex; justify-content: space-between; align-items: center; cursor: pointer;
  }
  .item-info { display: flex; flex-direction: column; text-align: left; }
  .row-date { font-size: 11px; color: #94a3b8; }
  .row-name { font-weight: bold; }
  .item-price { font-weight: bold; color: #1e293b; }
  </style>