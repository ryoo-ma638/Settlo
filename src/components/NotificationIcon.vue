<template>
  <div class="notification-wrapper">
    <button class="icon-btn" @click="showModal = true" aria-label="お知らせ">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span class="notification-dot"></span>
    </button>

    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-window">
          <h2 class="modal-title">お知らせ</h2>

          <div class="notification-list">
            <div class="notif-item pink">
              <span class="dot"></span>
              <p>〇〇さんから友達申請が届いています</p>
            </div>
            <div class="notif-item blue">
              <span class="dot"></span>
              <p>〇〇さんの友達申請が承認されました</p>
            </div>
            <div class="notif-item red">
              <p>〇〇さんから催促が来ています<br>今すぐお支払いしましょう</p>
            </div>
            <div class="notif-item yellow">
              <p>〇〇さんから一週間支払いをされていません</p>
            </div>
            
            <div class="notif-item pink">
              <p>追加のお知らせテスト1</p>
            </div>
            <div class="notif-item blue">
              <p>追加のお知らせテスト2</p>
            </div>
            <div class="notif-item yellow">
              <p>追加のお知らせテスト3</p>
            </div>
            <div class="notif-item pink">
              <p>スクロール確認用：一番下のお知らせです</p>
            </div>
          </div>

          <button class="close-modal-btn" @click="showModal = false">閉じる</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const showModal = ref(false);
</script>

<style scoped>
/* アイコンボタンの設定 */
.icon-btn {
  background: none; border: none; padding: 5px; cursor: pointer;
  color: #334155; position: relative; display: flex;
}
.notification-dot {
  position: absolute; top: 2px; right: 4px;
  width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; border: 2px solid white;
}

/* 画面全体の背景 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  box-sizing: border-box;
}

/* 白い窓本体 */
.modal-window {
  width: 100%;
  max-width: 350px;
  max-height: 80vh; /* 画面の8割を超えないように制限 */
  background-color: #eef7ff;
  border-radius: 30px;
  padding: 25px;
  display: flex;
  flex-direction: column; /* タイトル、リスト、ボタンを縦に並べる */
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
}

.modal-title {
  font-size: 26px; font-weight: bold; margin-bottom: 20px;
  color: #1a1a1a !important; text-align: center;
  flex-shrink: 0; /* タイトルが潰れないように固定 */
}

/* 🌟 お知らせリスト領域（スクロールの設定） */
.notification-list {
  flex: 1; /* 窓の中で可能な限り広がる */
  overflow-y: auto; /* 縦方向に中身が溢れたらスクロールさせる */
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 5px 2px;
  
  /* スクロールバーのデザイン（iOS/Androidでは自動で隠れることが多いです） */
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch; /* iPhoneでのスクロールを滑らかにする */
}

/* 各お知らせのカード */
.notif-item {
  position: relative; padding: 15px; border-radius: 22px;
  font-size: 14px; font-weight: bold; line-height: 1.4;
  color: #1a1a1a !important; text-align: left;
  flex-shrink: 0; /* 🌟 リスト内で高さが潰れないように固定 */
}

.dot {
  position: absolute; left: -6px; top: 14px;
  width: 14px; height: 14px; background-color: #40ffff;
  border-radius: 50%; border: 2px solid #eef7ff;
}

/* 配色パターン */
.pink { background-color: #fce4e4 !important; }
.blue { background-color: #8bb4ff !important; }
.red { background-color: #ff6b6b !important; color: #ffffff !important; }
.yellow { background-color: #fff48f !important; }

/* 閉じるボタン */
.close-modal-btn {
  margin-top: 20px; padding: 12px 40px; background-color: white;
  color: #3b82f6; border: none; border-radius: 25px;
  font-weight: bold; font-size: 16px; cursor: pointer;
  flex-shrink: 0; /* ボタンが潰れないように固定 */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.close-modal-btn:active { transform: scale(0.95); }
</style>