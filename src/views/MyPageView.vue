<template>
  <div class="mypage-container">
    
    <section class="profile-section">
      <img :src="userPhoto" class="user-circle-large" />
      <h1 class="user-name">{{ userName }}</h1>
      <p class="account-type">Google アカウント</p>
    </section>

    <section class="menu-section">
      <ul class="menu-list">
        <li class="menu-item" @click="$router.push('/edit-profile')">
          <span>✏️ プロフィールを変更する</span>
          <span class="arrow">›</span>
        </li>
        
        <li class="menu-item hide-on-pc" @click="$router.push('/friend')">
          <span>👥 フレンド管理</span>
          <span class="arrow">›</span>
        </li>
        <li class="menu-item hide-on-pc" @click="$router.push('/payment-history')">
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
import { ref, onMounted } from "vue";

const router = useRouter();
const userName = ref("");
const userPhoto = ref("");

const logout = async () => {
  console.log("ログアウト押された！");
  try {
    await signOut(auth);
    console.log("ログアウト成功");
    router.push("/login");
  } catch (error) {
    console.error("ログアウトエラー", error);
  }
};

onMounted(() => {
  const user = auth.currentUser;
  if (user) {
    userName.value = user.displayName;
    userPhoto.value = user.photoURL;
  }
});
</script>

<style scoped>
/* マイページ固有のスタイル */
.mypage-container {
  padding: 30px 20px;
  background-color: #f0f4f8; 
  min-height: calc(100vh - 175px); 
}

/* 1. プロフィールエリア */
.profile-section { text-align: center; margin-bottom: 40px; }
.user-circle-large {
  width: 120px; height: 120px; background-color: #e3a8a8; 
  border-radius: 50%; margin: 0 auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  object-fit: cover; /* 🌟 画像が歪まないように追加 */
}
.user-name { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; color: #000; }
.account-type { font-size: 14px; color: #64748b; margin: 0; }

/* 2. メニューセクション */
.menu-section { background-color: #fff; border-radius: 20px; padding: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.menu-list { list-style: none; padding: 0; margin: 0; }
.menu-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 15px; border-bottom: 1px solid #eee; font-size: 16px;
  font-weight: bold; color: #1e293b; cursor: pointer; transition: background-color 0.2s;
}
.menu-item:last-child { border-bottom: none; }
.menu-item:active { background-color: #f8fafc; }
.arrow { font-size: 24px; color: #cbd5e1; font-family: serif; }

/* ログアウト用の特別なスタイル */
.menu-item.logout { color: #ef4444; }
.menu-item.logout .arrow { color: #fca5a5; }

/* 🌟 追加：PCサイズ（例：1024px以上）になったら非表示にする */
@media (min-width: 1024px) {
  .hide-on-pc {
    display: none !important;
  }
}
</style>