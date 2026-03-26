<template>
  <AppSidebar 
    :isOpen="isSidebarOpen" 
    @close="isSidebarOpen = false" 
    @open-notification="handleOpenNotification"
  />

  <header class="header">
    
    <div class="header-left">
      <div class="user-icon-container" @click="navigate('/mypage')">
        <div class="user-circle"></div>
        <span class="user-name">名前</span>
      </div>
    </div>

    <div class="header-center">
      <h1 class="app-title" @click="navigate('/')">Settlo</h1>
    </div>

    <div class="header-right">
      <NotificationIcon ref="notifRef" />
      
      <button class="icon-btn" @click="isSidebarOpen = true" aria-label="メニューを開く">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </div>

  </header>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppSidebar from './AppSidebar.vue';
import NotificationIcon from './NotificationIcon.vue';

const router = useRouter();
const isSidebarOpen = ref(false);
const notifRef = ref(null); // お知らせコンポーネントを操作するための参照

const navigate = (path) => {
router.push(path);
};

// 🌟 サイドバーで「お知らせ」が押された時の処理
const handleOpenNotification = () => {
isSidebarOpen.value = false; // 先にメニューを閉じる
// メニューが閉じるアニメーションを待ってからお知らせを開く
setTimeout(() => {
  notifRef.value?.open();
}, 200);
};
</script>

<style scoped>
/* ヘッダー全体（スクロール追従・ぼかし効果） */
.header {
position: sticky; top: 0; z-index: 1000; display: flex; justify-content: space-between; align-items: center;
padding: 10px 20px; background-color: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px);
box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); height: 75px; box-sizing: border-box;
}

.header-left, .header-right { flex: 1; display: flex; align-items: center; }
.header-left { justify-content: flex-start; }
.header-right { justify-content: flex-end; gap: 15px; }
.header-center { flex: 2; text-align: center; }

.user-icon-container { display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: opacity 0.2s; }
.user-icon-container:active { opacity: 0.5; }
.user-circle { width: 40px; height: 40px; background-color: #d9a0a0; border-radius: 50%; }
.user-name { font-size: 11px; color: #333; margin-top: 4px; font-weight: bold; }
.app-title { 
  font-size: 26px; font-weight: 900; color: #059669; margin: 0; letter-spacing: 1px; 
  cursor: pointer; transition: opacity 0.2s; 
}
.app-title:active {
  opacity: 0.5; 
}

.icon-btn {
background: none; border: none; padding: 5px; cursor: pointer; color: #334155; position: relative;
display: flex; align-items: center; justify-content: center; transition: transform 0.2s, color 0.2s;
}
.icon-btn:active { transform: scale(0.9); color: #059669; }
</style>