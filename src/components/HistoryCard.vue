<template>
    <div class="history-card">
      <div class="card-left">
        <div class="avatar" :style="{ backgroundColor: item.color || '#cbd5e1' }"></div>
        <div class="info">
          <p class="name">{{ item.name }}</p>
          <p class="details">{{ item.date }} • {{ item.eventName }}</p>
        </div>
      </div>
      
      <div class="card-right">
        <p class="amount" :class="item.type === 'pay' ? 'orange-text' : 'blue-text'">
          {{ item.type === 'pay' ? '-' : '+' }} ¥{{ item.amount.toLocaleString() }}
        </p>
        <span v-if="item.status === 'completed'" class="status-badge">決済完了 ✅</span>
      </div>
    </div>
  </template>
  
  <script setup>
  defineProps({
    item: {
      type: Object,
      required: true
    }
  });
  </script>
  
  <style scoped>
  .history-card { 
    background-color: white; display: flex; justify-content: space-between; align-items: center; 
    padding: 15px 20px; border-radius: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); margin-bottom: 12px;
  }
  .card-left { display: flex; align-items: center; gap: 15px; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
  .info { display: flex; flex-direction: column; }
  .name { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0 0 4px 0; }
  .details { font-size: 12px; color: #64748b; margin: 0; }
  
  .card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .amount { font-size: 18px; font-weight: bold; margin: 0; }
  .blue-text { color: #3b82f6; } /* 受け取りは青 */
  .orange-text { color: #f59e0b; } /* 支払いはオレンジ */
  
  .status-badge { font-size: 10px; background-color: #f1f5f9; color: #64748b; padding: 4px 8px; border-radius: 12px; font-weight: bold; }
  </style>