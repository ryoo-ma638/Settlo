<template>
  <div class="mypage-container">
    
    <section class="profile-section">
      <img :src="userPhoto" class="user-circle-large" />
      <h1 class="user-name">{{ userName }}</h1>

      <div class="id-copy-box" @click="copyMyId">
        <span class="id-label">ID:</span>
        <span class="id-value">{{ userUid }}</span>
        <span class="copy-icon">📋</span>
      </div>

      <p class="account-type">Google アカウント</p>
    </section>

    <section class="menu-section">
      <ul class="menu-list">
        <li class="menu-item" @click="$router.push('/edit-profile')">
          <span>✏️ プロフィールを変更する</span>
          <span class="arrow">›</span>
        </li>
        
        <li class="menu-item hide-on-pc">
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
import { auth ,db } from "../firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import { doc, getDoc } from "firebase/firestore";

const router = useRouter();
const userName = ref("");
const userPhoto = ref("");
const userUid = ref(""); // 🌟 UID保存用に追加

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

// 🌟 コピー用関数を追加
const copyMyId = async () => {
  try {
    await navigator.clipboard.writeText(userUid.value);
    alert("マイIDをコピーしました！");
  } catch (err) {
    console.error("コピー失敗", err);
  }
};

// MyPageView.vue の修正案
onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    // 🌟 1. Firestore から自分のドキュメントを読み込む
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      // 🌟 2. Firestore の 'photo' フィールドを使う
      // もし photo がなければ Auth の photoURL を使う（バックアップ）
      userPhoto.value = data.photo || user.photoURL;
      userName.value = data.name || user.displayName;
    } else {
      // ドキュメントがない場合のフォールバック
      userName.value = user.displayName;
      userPhoto.value = user.photoURL;
    }
    userUid.value = user.uid;
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
.id-copy-box {
  display: inline-flex;  align-items: center;  gap: 5px;  background-color: #fff;
  padding: 4px 12px;  border-radius: 15px;  margin: 10px 0;  cursor: pointer;
  border: 1px solid #e2e8f0;  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.id-label {
  font-size: 10px;  color: #94a3b8;  font-weight: bold;
}
.id-value {
  font-size: 12px;  font-family: monospace;  color: #475569;
}
.copy-icon {
  font-size: 12px;  color: #2169a3;
}
.account-type {
  margin-top: 5px; /* 少し隙間を調整 */
}

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