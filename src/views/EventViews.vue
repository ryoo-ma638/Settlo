<template>
    <div class="event-page-container">
      <header class="page-header">
        <h1 class="page-title">進行中のイベント</h1>
        <button class="check-settle-btn" @click="$router.push('/payment')">
          精算を確認する
        </button>
      </header>
  
      <main class="list-content">
        <div 
          class="event-card" 
          v-for="event in events" 
          :key="event.id" 
          @click="$router.push(`/event/${event.id}`)"
        >
          <div class="card-header">
            <span class="event-tag" :class="event.tagColor">{{ event.tag }}</span>
            <span class="event-date">{{ event.date }}</span>
          </div>
          <h2 class="event-name">{{ event.name }}</h2>
          
          <div class="card-footer">
            <div class="participants">
              <div 
                class="avatar" 
                v-for="(p, index) in event.participants.slice(0, 4)" 
                :key="index"
                :style="{ backgroundColor: p.color, zIndex: 4 - index }"
              ></div>
              <div v-if="event.participants.length > 4" class="avatar-more">
                +{{ event.participants.length - 4 }}
              </div>
            </div>
            <div class="total-amount">
              <span class="label">合計金額</span>
              <span class="amount">¥{{ event.totalAmount.toLocaleString() }}</span>
            </div>
          </div>
        </div>
  
        <div v-if="events.length === 0" class="empty-msg">
          進行中のイベントはありません
        </div>
      </main>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  // 🌟 ダミーデータ（後でFirebaseから取得）
  const events = ref([
    { 
      id: 1, name: '鈴○サーキット', date: '2026/03/25', tag: '遊び', tagColor: 'blue-tag', totalAmount: 18500,
      participants: [{color: '#fca5a5'}, {color: '#93c5fd'}, {color: '#86efac'}] 
    },
    { 
      id: 2, name: '3-7高校飲み会！', date: '2026/03/28', tag: '飲み会', tagColor: 'orange-tag', totalAmount: 42000,
      participants: [{color: '#fca5a5'}, {color: '#93c5fd'}, {color: '#86efac'}, {color: '#fde047'}, {color: '#d8b4fe'}] 
    }
  ]);
  </script>
  
  <style scoped>
  .event-page-container { min-height: 100vh; background-color: #f0f4f8; padding-bottom: 0px; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10; }
  .page-title { font-size: 20px; font-weight: bold; margin: 0; color: #1e293b; }
  .check-settle-btn { background-color: #2169a3; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(33,105,163,0.3); transition: 0.2s; }
  .check-settle-btn:active { transform: scale(0.95); }
  
  .list-content { padding: 10px 20px; display: flex; flex-direction: column; gap: 15px; }
  .event-card { background: white; border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s; }
  .event-card:active { transform: scale(0.98); background-color: #f8fafc; }
  
  .card-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
  .event-tag { padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: bold; color: white; }
  .blue-tag { background-color: #3b82f6; }
  .orange-tag { background-color: #f59e0b; }
  .event-date { font-size: 12px; color: #94a3b8; }
  
  .event-name { font-size: 18px; font-weight: bold; margin: 0 0 20px 0; color: #1e293b; }
  
  .card-footer { display: flex; justify-content: space-between; align-items: flex-end; }
  .participants { display: flex; align-items: center; }
  .avatar, .avatar-more { width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; margin-left: -10px; }
  .avatar:first-child { margin-left: 0; }
  .avatar-more { background-color: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; color: #64748b; margin-left: -10px; z-index: 0; }
  
  .total-amount { display: flex; flex-direction: column; align-items: flex-end; }
  .label { font-size: 10px; color: #64748b; }
  .amount { font-size: 20px; font-weight: 900; color: #1e293b; }
  
  .empty-msg { text-align: center; color: #94a3b8; font-weight: bold; margin-top: 40px; }
  </style>