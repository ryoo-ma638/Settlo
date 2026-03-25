<template>
  <div class="make-event-container">
    <h2 class="page-title">新規イベント作成/参加</h2>

    <div class="input-section">
      <label class="input-label">イベント詳細</label>
      <input type="text" placeholder="例：旅行" class="input-field shadow-box" />
    </div>

    <div class="input-section">
      <label class="input-label">メモ</label>
      <textarea placeholder="目的、ルールなど" class="textarea-field shadow-box"></textarea>
    </div>

    <div class="input-section">
      <label class="input-label">イベントアイコン</label>
      <div class="icon-grid">
        <div class="icon-item active">🍽️<br>食事代</div>
        <div class="icon-item">🎮<br>遊び代</div>
        <div class="icon-item">🚗<br>交通費</div>
        <div class="icon-item">🛒<br>？？購入代</div>
        <div class="icon-item">💼<br>仕事</div>
        <div class="icon-item">その他</div>
      </div>
    </div>

    <div class="input-section">
      <label class="input-label">招待コード</label>
      <p class="sub-text">このコードを友人に共有して参加してもらいましょう</p>
      <div class="copy-box shadow-box">
        <span class="code">ABC123</span>
        <span class="copy-btn">■コピー</span>
      </div>
    </div>

    <div class="button-group">
      <button class="main-btn">イベントを作成する　→</button>
      <button class="sub-btn">イベントに参加する　👤</button>
    </div>
  </div>
</template>

<style scoped>
.make-event-container { padding: 20px; background-color: #eef7ff; min-height: 100vh; }
.page-title { color: #2169a3; font-size: 22px; font-weight: bold; margin-bottom: 20px; text-align: left; }
.input-section { margin-bottom: 20px; }
.input-label { display: block; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
.shadow-box { background-color: #dcdcdc; border: none; border-radius: 10px; padding: 12px; width: 100%; box-sizing: border-box; color: #666; }
.textarea-field { height: 100px; resize: none; }
.icon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.icon-item { background-color: #dcdcdc; border-radius: 10px; padding: 15px 5px; text-align: center; font-size: 12px; font-weight: bold; cursor: pointer; }
.icon-item.active { background-color: #2b78ba; color: white; }
.sub-text { font-size: 11px; color: #666; margin-bottom: 5px; }
.copy-box { display: flex; justify-content: space-between; align-items: center; background-color: #fff; }
.code { color: #2169a3; font-weight: bold; font-size: 18px; }
.copy-btn { color: #2169a3; font-size: 14px; font-weight: bold; }
.button-group { margin-top: 30px; display: flex; flex-direction: column; gap: 12px; }
.main-btn { background-color: #2169a3; color: white; border: none; border-radius: 10px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }
.sub-btn { background-color: #fff; color: #2169a3; border: 2px solid #2169a3; border-radius: 10px; padding: 12px; font-size: 16px; font-weight: bold; cursor: pointer; }
</style>