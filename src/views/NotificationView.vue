<template>
  <div class="notification-container">
    <h2 class="title">お知らせ</h2>
    <div class="list">
      <div class="item">
        <p class="date">2026/03/25</p>
        <p class="text">新しい友達リクエストが届いています。</p>
      </div>
      <div class="item">
        <p class="date">2026/03/24</p>
        <p class="text">「飲み会代」の精算が完了しました！</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-container { padding: 20px; }
.title { font-size: 20px; font-weight: bold; margin-bottom: 20px; }
.item { background: white; padding: 15px; border-radius: 12px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.date { font-size: 12px; color: #888; margin: 0; }
.text { margin: 5px 0 0 0; font-size: 14px; }
</style>