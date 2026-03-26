<template>
    <div class="friend-card" @click="$emit('click', user)">
      <div class="friend-avatar" :style="{ backgroundColor: user.color }"></div>
      <div class="friend-info">
        <span class="friend-name-text">{{ user.name }}</span>
        <div class="status-tags">
          <span v-if="!user.isFriend" class="tag not-friend">未フレンド</span>
          <span v-if="user.isTrading" class="tag trading">取引中</span>
          <span class="tag count">取引: {{ user.tradeCount }}回</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  defineProps({ user: Object });
  defineEmits(['click']);
  </script>
  
  <style scoped>
  .friend-card { background-color: white; display: flex; align-items: center; padding: 15px 25px; border-radius: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; transition: 0.2s; }
  .friend-card:active { transform: scale(0.98); }
  .friend-avatar { width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; flex-shrink: 0; }
  .friend-info { display: flex; flex-direction: column; gap: 5px; }
  .friend-name-text { font-size: 18px; font-weight: bold; color: #1e293b; }
  .status-tags { display: flex; gap: 8px; }
  .tag { font-size: 10px; padding: 3px 8px; border-radius: 12px; font-weight: bold; }
  .not-friend { background: #fee2e2; color: #ef4444; }
  .trading { background: #e0f2fe; color: #3b82f6; }
  .count { background: #f1f5f9; color: #64748b; }
  </style>