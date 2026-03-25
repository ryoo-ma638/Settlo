<template>
  <div class="mypage-container">
    
    <div class="page-title-pill">
      マイページ
    </div>

    <p class="user-id">ID : xxxxxxxx</p>

    <div class="profile-icon-wrapper">
      <div class="user-circle-large">
        <span class="camera-icon">📷</span>
      </div>
    </div>

    <h1 class="user-name">名前</h1>

    <button class="btn-outline-green">プロファイルを編集</button>

    <div class="action-buttons">
      <button class="btn-orange" @click="$router.push('/friend')">フレンドリスト</button>
      
      <button class="btn-orange logout" @click="$router.push('/login')">ログアウト</button>
      
    </div>

  </div>
</template>

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
</style>