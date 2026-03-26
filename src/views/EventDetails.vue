<template>
  <div class="event-detail-container">
    <button class="back-to-list-button" @click="$router.push('/event')">⬅︎イベントに戻る</button>
    <header class="event-info-card">
      <div class="card-header">
        <h1 class="event-title">イベント名</h1>
        <span class="event-date">日付</span>
      </div>
      
      <div class="total-amount-section">
        <p class="amount-label">合計金額</p>
      </div>

      <div class="participants-section">
        <div class="participants-header">
          <h2 class="section-sub-title">参加者</h2>
          <button class="add-button invite-button">＋招待</button>
        </div>
        <div class="avatar-list">
          <span 
            class="avatar-circle" 
            v-for="(color, index) in ['#ff8a65', '#64b5f6', '#81c784', '#fff176', '#ba68c8']" 
            :key="index"
            :style="{ backgroundColor: color }"
          ></span>
          <span class="avatar-more">+1</span>
        </div>
      </div>
    </header>

    <section class="history-section">
      <div class="history-header">
        <h2 class="section-title">立て替え履歴</h2>
        <button class="add-button payment-button">＋支払いを追加</button>
      </div>

      <div class="timeline-container">
        <div class="timeline-line"></div>
            
        <div class="history-list">
          <div class="history-item" v-for="i in 3" :key="i">
            <div class="item-content">
              <div class="item-header">
                <span class="item-name">立て替え名</span>
                <span class="item-price">料金</span>
              </div>
              <span 
                class="item-avatar-circle" 
                :style="{ backgroundColor: ['#ff8a65', '#81c784', '#64b5f6'][i-1] }"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <div class="scroll-down-icon">
        <div class="triangle"></div>
      </div>
    </section>

    <footer class="footer-action">
      <button class="end-event-button">イベントを削除する</button>
    </footer>
  </div>
</template>

<script setup>
// 特にロジックが必要ないため空白です
</script>

<style scoped>
/* フォントは画像に近いゴシック体（Noto Sans JP）を指定 */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');

.back-to-list-button {
    background-color: transparent;
    border: none;
    color: #0076a3; /* 画像より抽出した青緑系 */
    font-weight: bold;
    font-family: inherit;
    cursor: pointer;
    margin-bottom: 15px;
}

.event-detail-container {
  font-family: 'Noto Sans JP', sans-serif;
  background-color: #e3f2fd; /* 薄い青の背景色 */
  min-height: auto;
  padding: 20px 30px 40px; /* 下部ボタン用の余白 */
  box-sizing: border-box;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-title {
  margin-top: 0;
  font-size: 24px;
  font-weight: bold;
}

.total-amount-section {
  text-align: center;
  margin-top: -10px;
  margin-bottom: 20px;
}

.amount-label {
  display: block;
  font-size: 30px;
  font-weight: bold;
  color: #000;
  margin: 0;
}

.participants-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

/* 共通の追加ボタン（青緑系）スタイル */
.add-button {
  background-color: #0076a3; /* 画像より抽出した青緑系 */
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  font-family: inherit;
  padding: 10px 25px;
  font-size: 13px;
  border-radius: 30px;
}

.avatar-circle {
  display: inline-block; /* サイズを指定可能にする */
  width: 35px;           /* 幅 */
  height: 35px;          /* 高さ */
  border-radius: 50%;    /* 正円にする */
  margin-right: 8px;     /* 丸同士の間隔 */
}

.avatar-list {
  display: flex;
  align-items: center;
  margin-top: -20px; /* 前の質問で「上にしたい」とのことだったので微調整 */
}

.avatar-more {
  font-size: 16px;
  font-weight: bold;
  color: #666;
  margin-left: 5px;
}

/* =========================================
   メイン イベント情報カード
   ========================================= */
.event-info-card {
  background-color: white;
  border-radius: 30px; /* 画像のように角を丸く */
  padding: 30px 20px 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.2);
  font-family: inherit;
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

/* --- 立て替え履歴セクションのレイアウト --- */
.timeline-container {
  position: relative;
  display: flex;
  padding-left: 40px; /* 左側にタイムライン用のスペースを確保 */
}

/* タイムラインの縦線 */
.timeline-line {
  position: absolute;
  left: 15px;
  top: 10px;
  bottom: 0;
  width: 4px;
  background-color: #ccc;
  border-radius: 2px;
}

/* グレーの背景コンテナ */
.history-list {
  flex: 1;
  background-color: #d1d5db; /* 画像のような薄いグレー */
  padding: 15px;
  border-radius: 15px;
}

.history-item {
  position: relative;
  margin-bottom: 15px;
}

/* タイムライン上の丸い点 */
.history-item::before {
  content: "";
  position: absolute;
  left: -47px; /* 縦線の位置に合わせる */
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  background-color: #ccc;
  border-radius: 50%;
  z-index: 2;
}

/* 白いカード部分 */
.item-content {
  background-color: white;
  border-radius: 25px; /* 画像のようにかなり丸める */
  padding: 12px 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.item-name {
  font-weight: bold;
  font-size: 14px;
}

.item-price {
  font-size: 14px;
}

/* カード内の小さなアバター（丸） */
.item-avatar-circle {
  display: block;
  width: 25px;
  height: 25px;
  border-radius: 50%;
}

/* ▼ アイコンの調整 */
.scroll-down-icon {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.footer-action {
  left: 0;
  width: 100%;       /* 横幅いっぱいのエリアを作る */
  display: flex;     /* Flexboxを使う */
  justify-content: center; /* 中のボタンを横方向の中央に配置 */
  align-items: center;
  padding: 0 20px;   /* 念のため左右に余白 */
  box-sizing: border-box;
  margin-top: 30px;    /* 上のコンテンツ（履歴リスト）との距離を広げる */
}

.end-event-button {
  background-color: #8F9600; /* 画像より抽出した緑系 */
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  font-family: inherit;
  padding: 10px 25px;
  font-size: 20px;
  border-radius: 30px;
}
</style>