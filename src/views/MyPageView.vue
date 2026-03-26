<template>
  <div class="mypage-container"> <div class="page-title-pill">
      マイページ
    </div>

    <section class="profile-section">
      <div class="user-circle-large">
        <img v-if="user?.photoURL" :src="user.photoURL" class="user-photo" />
        <span v-else class="camera-icon">📷</span>
      </div>
      <h1 class="user-name">{{ user?.displayName || '名前' }}</h1>
      <p class="account-type">Google アカウント</p>
    </section>

    <section class="menu-section">
      <ul class="menu-list">
        <li class="menu-item" @click="$router.push('/friend')">
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
import { signOut } from "firebase/auth";
import { useRouter } from "vue-router";

const router = useRouter();
const user = auth.currentUser;

const logout = async () => {
  try {
    await signOut(auth);

    console.log("ログアウト成功");

    // ログイン画面へ移動
    router.push("/login");

  } catch (error) {
    console.error("ログアウト失敗", error);
  }
};
</script>

<style scoped>
.mypage-container {
  padding: 30px 20px;
  text-align: center; /* 全体を中央揃え */
  background-color: #f0f4f8; 
  min-height: calc(100vh - 175px);
  font-family: 'Noto Sans JP', sans-serif;
}

/* グレーのタイトルピル */
.page-title-pill {
  background-color: #d1d5db;
  color: #000;
  font-size: 24px;
  font-weight: bold;
  padding: 10px 40px;
  border-radius: 30px;
  display: inline-block;
  margin-bottom: 20px;
}

/* ユーザーID */
.user-id {
  font-size: 12px;
  font-weight: bold;
  text-align: right;
  padding-right: 30px;
  margin-bottom: 20px;
}

/* プロフィールアイコン */
.profile-icon-wrapper {
  margin-bottom: 15px;
}
.user-circle-large {
  width: 90px;
  height: 90px;
  background-color: #d9a0a0; /* 画像のくすみピンク */
  border-radius: 50%;
  margin: 0 auto;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.camera-icon {
  font-size: 24px;
  opacity: 0.6;
}

/* ユーザー名 */
.user-name {
  font-size: 28px;
  font-weight: bold;
  margin: 0 0 15px 0;
  color: #000;
}

/* 緑枠のボタン */
.btn-outline-green {
  background-color: #fff;
  color: #059669; /* 濃い緑 */
  border: 3px solid #059669;
  border-radius: 25px;
  padding: 8px 30px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 40px;
}

/* オレンジのボタン群 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0 10px;
}
.btn-orange {
  background-color: #fca566; /* 画像のオレンジ */
  color: #fff;
  border: none;
  border-radius: 30px;
  padding: 15px 0;
  font-size: 22px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: opacity 0.2s;
}
.btn-orange:active {
  opacity: 0.8;
}

/*プロフィール画像用のスタイル */
.user-photo {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

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
