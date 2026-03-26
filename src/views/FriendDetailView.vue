<template>
  <div class="friend-detail-container">
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <div class="user-info-block">
        <div class="user-avatar" style="background-color: #ff9980;"></div>
        <h1 class="user-name">{{ $route.params.name }}</h1>
      </div>
      <button class="delete-link-btn">削除する</button>
    </header>

    <main class="scroll-content">
      <h2 class="section-title">お支払い状況</h2>

      <section class="status-section">
        <div class="status-header">
          <span class="status-badge blue-badge">お支払い待ち</span>
          <span class="total-amount blue-text">¥0</span>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'w'+n" class="event-card blue-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button class="action-btn green-btn">催促する</button></div>
          </div>
        </div>
      </section>

      <section class="status-section">
        <div class="status-header">
          <span class="status-badge orange-badge">未払い</span>
          <span class="total-amount orange-text">¥0</span>
          <button class="action-btn green-btn pay-all-btn">まとめて支払う</button>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'u'+n" class="event-card orange-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button class="action-btn green-btn">支払いを完了させる</button></div>
          </div>
        </div>
      </section>

      <section class="history-section">
        <button class="history-toggle-btn">過去の履歴</button>
        <div class="history-list">
          <div v-for="n in 5" :key="'h'+n" class="history-card">
            <span class="history-event-name">イベント名{{n}}</span>
            <div class="history-flow"><div class="avatar dummy-me"></div><span class="arrow">→</span><div class="avatar dummy-friend"></div></div>
            <span class="history-amount">¥0</span>
            <span class="check-icon">✅</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.friend-detail-container { 
  height: calc(100vh - 85px); /* フッター分を引く */
  background-color: #eef7ff; 
  display: flex;
  flex-direction: column;
}

.detail-header { 
  flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; 
  padding: 15px 20px; background-color: #fff; border-radius: 0 0 25px 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.scroll-content { flex: 1; overflow-y: auto; padding: 20px; scrollbar-width: none; }
.scroll-content::-webkit-scrollbar { display: none; }

.back-btn { background: none; border: none; font-size: 32px; color: #2169a3; cursor: pointer; }
.user-info-block { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 45px; height: 45px; border-radius: 50%; }
.user-name { font-size: 20px; font-weight: bold; margin: 0; }
.delete-link-btn { background: none; border: none; color: #ff0000; font-size: 14px; font-weight: bold; }

.section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: left; }
.status-section { background-color: #fff; border-radius: 20px; padding: 15px; margin-bottom: 20px; }
.status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; position: relative; }
.status-badge { padding: 4px 12px; border-radius: 15px; color: white; font-size: 11px; font-weight: bold; }
.blue-badge { background-color: #3b82f6; }
.orange-badge { background-color: #f59e0b; }
.total-amount { font-size: 28px; font-weight: bold; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.pay-all-btn { position: absolute; right: 0; }

.event-list { display: flex; flex-direction: column; gap: 10px; }
.event-card { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-radius: 12px; }
.blue-card { background-color: #e0f2fe; }
.orange-card { background-color: #ffedd5; }
.event-info { display: flex; flex-direction: column; text-align: left; }
.event-date { font-size: 11px; color: #666; }
.event-name { font-size: 15px; font-weight: bold; }
.event-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.event-amount { font-size: 16px; font-weight: bold; }
.action-btn { padding: 5px 12px; border-radius: 20px; border: none; font-size: 11px; font-weight: bold; color: #fff; cursor: pointer; }
.green-btn { background-color: #22c55e; }

.history-toggle-btn { width: 100%; padding: 12px; background-color: #93c5fd; color: #fff; border: none; border-radius: 15px; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
.history-card { background-color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 40px; margin-bottom: 10px; }
.history-event-name { font-size: 16px; font-weight: bold; }
.history-flow { display: flex; align-items: center; gap: 8px; }
.avatar { width: 25px; height: 25px; border-radius: 50%; }
.dummy-me { background-color: #d9a0a0; }
.dummy-friend { background-color: #8bb4ff; }
.history-amount { font-size: 18px; font-weight: bold; }
.check-icon { color: #22c55e; }
</style>