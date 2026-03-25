<template>
  <div class="friend-container">
    <main class="content">
      <button class="add-friend-main-button">友達を追加する</button>
      
      <div class="request-section">
        <p class="request-alert">❗ 友達申請が届いています</p>
        <div class="request-card">
          <div class="request-avatar blue-avatar"></div>
          <span class="request-name">名前</span>
          <button class="approve-button">承認</button>
        </div>
      </div>

      <h2 class="list-title">友達リスト</h2>
      <div class="friend-list">
        <div 
          class="friend-card" 
          v-for="(color, index) in ['#ff9980', '#ffee10', '#ff0000', '#889900', '#776666']" 
          :key="index"
        >
          <div class="friend-avatar" :style="{ backgroundColor: color }"></div>
          <span class="friend-name-text">名前</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Friendページ固有のスタイルのみ残しました */
.friend-container { 
  min-height: 100vh; 
  background-color: #eef7ff; 
  /* App.vueでpadding-bottomを設定しているので、ここはシンプルでOK */
}

.content { padding: 20px; }

.add-friend-main-button { 
  width: 100%; 
  padding: 12px; 
  background-color: #2169a3; 
  color: white; 
  border: none; 
  border-radius: 25px; 
  font-size: 18px; 
  font-weight: bold; 
  margin-bottom: 25px; 
}

.request-alert { font-weight: bold; font-size: 18px; margin-bottom: 10px; }

.request-card { 
  background-color: white; 
  display: flex; 
  align-items: center; 
  padding: 10px 20px; 
  border-radius: 40px; 
  margin-bottom: 25px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.05); 
}

.blue-avatar { 
  background-color: #8bb4ff; 
  width: 35px; 
  height: 35px; 
  border-radius: 50%; 
  margin-right: 15px; 
}

.request-name { flex: 1; font-size: 18px; font-weight: bold; }

.approve-button { 
  background-color: #ffedb3; 
  border: none; 
  padding: 8px 30px; 
  border-radius: 20px; 
  font-weight: bold; 
}

.list-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; }

.friend-card { 
  background-color: white; 
  display: flex; 
  align-items: center; 
  padding: 12px 25px; 
  border-radius: 50px; 
  margin-bottom: 12px; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.05); 
}

.friend-avatar { width: 45px; height: 45px; border-radius: 50%; margin-right: 20px; }
.friend-name-text { font-size: 24px; font-weight: bold; }
</style>