<template>
  <div class="sidebar-container">
    <div class="sidebar-overlay" v-if="isOpen && !isDesktop" @click="closeMenu"></div>

    <div class="sidebar-panel" :class="{ 'is-open': isOpen, 'pc-mode': isDesktop }">
      
      <button class="close-btn" v-if="!isDesktop" @click="closeMenu">✕</button>

      <div class="profile-section">
        <img :src="userPhoto" class="user-circle-large" />
        <div class="user-info">
          <h2 class="user-name">{{ userName || '読み込み中...' }}</h2>
          <p class="mypage-link" @click="navigate('/mypage')">⚙️ マイページ</p>
        </div>
      </div>

      <hr class="divider" />

      <ul class="menu-list">
        <li @click="navigate('/friend')"><span class="icon">👥</span> フレンド</li>
        
        <li v-if="!isDesktop" @click="$emit('open-notification')"> 
          <div class="menu-item-inner">
            <span><span class="icon">🔔</span> お知らせ</span>
            <span v-if="notificationCount > 0" class="badge">{{ notificationCount }}</span>
          </div>
        </li>
        
        <li @click="navigate('/payment-history')"><span class="icon">🕒</span> 履歴</li>
      </ul>

      <hr class="divider" />

      <ul class="menu-list">
        <li @click="navigate('/event')">
          <span class="icon">📅</span> 進行中のイベント
        </li>
        <li @click="navigate('/payment')">
          <span class="icon">💳</span> お金のお支払い
        </li>
      </ul>

      <hr class="divider" />

      <div class="bottom-actions">
        <button class="btn-primary" @click="navigate('/make-event')">＋ 新規イベント作成/参加</button>
        <button class="btn-home" @click="navigate('/')">🏠 ホーム</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db  } from "../firebase"; 
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const userName = ref("");
const userPhoto = ref("");
const notificationCount = ref(0);

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'open-notification'])
const router = useRouter()

const isDesktop = ref(window.innerWidth >= 1024)
const updateSize = () => {
  isDesktop.value = window.innerWidth >= 1024
}

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userName.value = user.displayName;
      userPhoto.value = user.photoURL;

      // 🌟 通知ドキュメントをリアルタイム監視してカウント
      const q = query(
        collection(db, "friendRequests"),
        where("toId", "==", user.uid),
        where("status", "in", ["pending", "accepted"])
      );

      // データが更新されるたびに件数を取得
      onSnapshot(q, (snapshot) => {
        notificationCount.value = snapshot.docs.length;
      });
    } else {
      notificationCount.value = 0; // ログアウト時はリセット
    }
  });

  window.addEventListener('resize', updateSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateSize)
})

const closeMenu = () => {
  emit('close')
}

const navigate = (path) => {
  router.push(path)
  if (!isDesktop.value) {
    closeMenu() // スマホの時だけメニューを閉じる
  }
}
</script>

<style scoped>
.sidebar-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
  background: rgba(0, 0, 0, 0.3); z-index: 2000;
}
.sidebar-panel {
  position: fixed; top: 0; right: -85%; width: 80%; max-width: 320px; height: 100vh;
  background: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  z-index: 2001; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 30px 0 0 30px; padding: 40px 25px 30px 25px;
  box-sizing: border-box; color: white;
  display: flex; flex-direction: column;
}
.sidebar-panel.is-open { right: 0; }
.close-btn {
  position: absolute; top: 20px; right: 20px;
  background: none; border: none; color: white;
  font-size: 20px; cursor: pointer; opacity: 0.7;
}
.profile-section { display: flex; align-items: center; margin-bottom: 20px; gap: 15px; }
.user-circle { width: 60px; height: 60px; background-color: #d9a0a0; border-radius: 50%; }
.user-circle-large {
  width: 60px; height: 60px; background-color: #e3a8a8; 
  border-radius: 50%; margin: 0 auto 15px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  object-fit: cover; /* 🌟 画像が歪まないように追加 */
  margin : 0; /* 画像の上下の余白をなくす */
}
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 22px; font-weight: bold; margin: 0; }
.mypage-link { font-size: 13px; color: #cbd5e1; margin: 5px 0 0 0; cursor: pointer; text-decoration: underline; }
.divider { border: none; border-top: 1px solid rgba(255, 255, 255, 0.2); margin: 15px 0; }
.menu-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.menu-list li { font-size: 16px; cursor: pointer; display: flex; align-items: center; transition: opacity 0.2s; }
.menu-list li:active { opacity: 0.6; }
.icon { margin-right: 15px; font-size: 18px; width: 24px; text-align: center; }
.menu-item-inner { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.badge { background-color: rgba(255, 255, 255, 0.2); font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.bottom-actions { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.btn-primary { background-color: #0d9488; color: white; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }
.btn-home { background-color: #334155; color: white; border: none; border-radius: 12px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }

/* 💻 PC版用のスタイル */
@media (min-width: 1024px) {
  .sidebar-panel.pc-mode {
    /* 🌟 修正：static ではなく sticky にして、スクロールしても画面上部に吸着し続けるようにしました */
    position: sticky;
    top: 0;
    width: 100%;
    max-width: none;
    height: 100vh;
    border-radius: 0;
    background: #1e293b;
  }
}
</style>