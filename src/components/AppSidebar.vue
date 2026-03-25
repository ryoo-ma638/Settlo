<template>
    <div class="sidebar-container">
      <div class="sidebar-overlay" v-if="isOpen" @click="closeMenu"></div>
  
      <div class="sidebar-panel" :class="{ 'is-open': isOpen }">
        
        <button class="close-btn" @click="closeMenu">✕</button>
  
        <div class="profile-section">
          <div class="user-circle"></div>
          <div class="user-info">
            <h2 class="user-name">名前</h2>
            <p class="mypage-link" @click="navigate('/mypage')">⚙️ マイページ</p>
          </div>
        </div>
  
        <hr class="divider" />
  
        <ul class="menu-list">
          <li @click="navigate('/friend')"><span class="icon">👥</span> フレンド</li>
          <li @click="navigate('/')">
            <div class="menu-item-inner">
              <span><span class="icon">🔔</span> お知らせ</span>
              <span class="badge">3</span>
            </div>
          </li>
          <li @click="navigate('/')"><span class="icon">🕒</span> 履歴</li>

  
        <ul class="menu-list">
          <li @click="navigate('/')"><span class="icon">📅</span> 進行中のイベント</li>
          <li @click="navigate('/payment')"><span class="icon">💳</span> お金のお支払い</li>
        </ul>
    </ul>
        <hr class="divider" />
  
        <div class="bottom-actions">
          <button class="btn-primary" @click="navigate('/')">＋ 新規イベント作成/参加</button>
          <button class="btn-home" @click="navigate('/')">🏠 ホーム</button>
        </div>
  
      </div>
    </div>
  </template>
  
  <script setup>
  import { useRouter } from 'vue-router'
  
  // ヘッダー（親）から「開いているかどうか」を受け取る
  const props = defineProps({
    isOpen: Boolean
  })
  
  // ヘッダー（親）に「閉じて！」と伝えるための設定
  const emit = defineEmits(['close'])
  
  const router = useRouter()
  
  // メニューを閉じる関数
  const closeMenu = () => {
    emit('close')
  }
  
  // ページ移動して、同時にメニューを閉じる関数
  const navigate = (path) => {
    router.push(path)
    closeMenu()
  }
  </script>
  
  <style scoped>
  /* 画面全体を覆うオーバーレイ */
  .sidebar-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
    background: rgba(0, 0, 0, 0.3); z-index: 2000;
  }
  
  /* すりガラス調のサイドバー本体 */
  .sidebar-panel {
    position: fixed; top: 0; right: -85%; width: 80%; max-width: 320px; height: 100vh;
    /* ここがすりガラスの魔法 */
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    
    z-index: 2001; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 30px 0 0 30px; /* 左側だけ丸くする */
    padding: 40px 25px 30px 25px;
    box-sizing: border-box;
    color: white;
    
    /* スクロールさせずに画面内に収めるFlexbox設定 */
    display: flex;
    flex-direction: column;
  }
  
  .sidebar-panel.is-open { right: 0; }
  
  /* 閉じるボタン */
  .close-btn {
    position: absolute; top: 20px; right: 20px;
    background: none; border: none; color: white;
    font-size: 20px; cursor: pointer; opacity: 0.7;
  }
  
  /* プロフィール */
  .profile-section { display: flex; align-items: center; margin-bottom: 20px; gap: 15px; }
  .user-circle { width: 60px; height: 60px; background-color: #d9a0a0; border-radius: 50%; }
  .user-info { display: flex; flex-direction: column; }
  .user-name { font-size: 22px; font-weight: bold; margin: 0; }
  .mypage-link { font-size: 13px; color: #cbd5e1; margin: 5px 0 0 0; cursor: pointer; text-decoration: underline; }
  
  /* 区切り線 */
  .divider { border: none; border-top: 1px solid rgba(255, 255, 255, 0.2); margin: 15px 0; }
  
  /* メニューリスト */
  .menu-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
  .menu-list li { font-size: 16px; cursor: pointer; display: flex; align-items: center; transition: opacity 0.2s; }
  .menu-list li:active { opacity: 0.6; }
  .icon { margin-right: 15px; font-size: 18px; width: 24px; text-align: center; }
  
  /* お知らせバッジ用 */
  .menu-item-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .badge { background-color: rgba(255, 255, 255, 0.2); font-size: 12px; padding: 2px 8px; border-radius: 10px; }
  
  /* 下部ボタン（画面下に押しやる） */
  .bottom-actions { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
  .btn-primary { background-color: #0d9488; color: white; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }
  .btn-home { background-color: #334155; color: white; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }
  </style>