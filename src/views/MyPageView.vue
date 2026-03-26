<template>
    <div class="mypage-container">
      
      <section class="profile-section">
        <img 
          v-if="user"
          :src="user.photoURL" 
          class="user-circle-large"
        />
        <h1 class="user-name">
          {{ user ? user.displayName : "未ログイン" }}
        </h1>
        <p class="account-type">Google アカウント</p>
      </section>
  
      <section class="menu-section">
        <ul class="menu-list">
          <li class="menu-item">
            <span>👥 フレンド管理</span>
            <span class="arrow">›</span>
          </li>
          <li class="menu-item">
            <span>🔔 お知らせ</span>
            <span class="arrow">›</span>
          </li>
          <li class="menu-item">
            <span>📜 お支払い履歴</span>
            <span class="arrow">›</span>
          </li>
          
          <li class="menu-item logout" @click="logout">
            <span>🚪 ログアウト</span>
            <span class="arrow">›</span>
          </li>
        </ul>
      </section>
  
    </div>
  </template>
  
<script setup>
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onMounted } from "vue";

// ユーザー情報を入れる箱
const user = ref(null);

// ログイン状態を監視（めっちゃ重要）
onMounted(() => {
  onAuthStateChanged(auth, (currentUser) => {
    user.value = currentUser;
    console.log("現在のユーザー:", currentUser);
  });
});

// ログアウト処理
const logout = async () => {
  await signOut(auth);
  alert("ログアウトしました");
};
</script>

  <style scoped>
  /* マイページ固有のスタイル (松岡さんのデザインベース) */
  .mypage-container {
    padding: 30px 20px;
    background-color: #f0f4f8; /* 共通背景色 */
    min-height: calc(100vh - 175px); /* ヘッダー・フッターを除く高さ */
  }
  
  /* 1. プロフィールエリア */
  .profile-section {
    text-align: center;
    margin-bottom: 40px;
  }
  .user-circle-large {
    width: 120px;
    height: 120px;
    background-color: #e3a8a8; /* ヘッダーのアイコンと同じピンク */
    border-radius: 50%;
    margin: 0 auto 15px auto;
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  }
  .user-name {
    font-size: 24px;
    font-weight: bold;
    margin: 0 0 5px 0;
    color: #000;
  }
  .account-type {
    font-size: 14px;
    color: #64748b; /* 薄いグレー */
    margin: 0;
  }
  
  /* 2. メニューセクション */
  .menu-section {
    background-color: #fff;
    border-radius: 20px;
    padding: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }
  .menu-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .menu-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 15px;
    border-bottom: 1px solid #eee;
    font-size: 16px;
    font-weight: bold;
    color: #1e293b;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .menu-item:last-child {
    border-bottom: none; /* 最後の項目は下線を消す */
  }
  .menu-item:active {
    background-color: #f8fafc; /* クリック時のフィードバック */
  }
  .arrow {
    font-size: 24px;
    color: #cbd5e1;
    font-family: serif; /* 矢印を綺麗に見せる */
  }
  
  /* ログアウト用の特別なスタイル */
  .menu-item.logout {
    color: #ef4444; /* 赤字 */
  }
  .menu-item.logout .arrow {
    color: #fca5a5; /* 矢印も少し赤っぽく */
  }
  </style>