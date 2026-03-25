<template>
    <div>
      <div class="sidebar-overlay" v-if="isSidebarOpen" @click="isSidebarOpen = false"></div>
      
      <div class="sidebar" :class="{ 'is-open': isSidebarOpen }">
        <div class="sidebar-content">
          
          <ul class="menu-group top-group">
            <li @click="router.push('/mypage'); isSidebarOpen = false">マイページ</li>
            <li @click="router.push('/friend'); isSidebarOpen = false">フレンド</li>
            <li @click="isSidebarOpen = false">お知らせ</li>
            <li @click="isSidebarOpen = false">履歴</li>
          </ul>

          <ul class="menu-group middle-group">
            <li @click="isSidebarOpen = false">新規イベント作成/参加</li>
            <li @click="isSidebarOpen = false">進行中のイベント</li>
            <li @click="router.push('/payment'); isSidebarOpen = false">お金のお支払い</li>
          </ul>

          <div class="sidebar-footer">
            <p class="back-home" @click="router.push('/'); isSidebarOpen = false">ホームへ戻る</p>
          </div>
        </div>
      </div>
  
      <header class="header">
        <div class="user-icon-container" @click="goToMyPage" style="cursor: pointer;">
          <div class="user-circle"></div>
          <span class="user-name">名前</span>
        </div>
        
        <h1 class="app-title">アプリ名</h1>

        <div class="header-icons">
          <div class="icon-black"></div>
          <div class="icon-black menu-trigger" @click="isSidebarOpen = true"></div>
        </div>
      </header>
    </div>
</template>
  
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router'; 
  
const isSidebarOpen = ref(false);
const router = useRouter(); 
  
// マイページへ移動する関数
const goToMyPage = () => {
  router.push('/mypage');
};
</script>
  
<style scoped>
/* スタイル（見た目）は変更なしです */
.sidebar-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.4); z-index: 1000; }
.sidebar { position: fixed; top: 0; right: -75%; width: 75%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 1001; transition: right 0.3s ease; padding: 60px 30px; box-sizing: border-box; color: white; }
.sidebar.is-open { right: 0; }
.sidebar-content { display: flex; flex-direction: column; height: 100%; text-align: left; }
.menu-group { list-style: none; padding: 0; margin: 0; }
.top-group { margin-bottom: 40px; }
.middle-group { margin-bottom: auto; }
.menu-group li { font-size: 20px; font-weight: bold; padding: 15px 0; cursor: pointer; }
.sidebar-footer { padding-bottom: 40px; text-align: center; }
.back-home { font-size: 18px; font-weight: bold; cursor: pointer; color: #aaa; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background-color: #d9d9d9; height: 90px; box-sizing: border-box; }
.user-icon-container { width: 60px; text-align: center; transition: opacity 0.2s; }
.user-icon-container:active { opacity: 0.5; }
.user-circle { width: 45px; height: 45px; background-color: #e3a8a8; border-radius: 50%; margin: 0 auto; }
.user-name { font-size: 12px; display: block; margin-top: 4px; color: #333; }
.app-title { font-size: 28px; font-weight: bold; flex: 1; text-align: center; margin: 0; }
.header-icons { display: flex; gap: 8px; width: 60px; justify-content: flex-end; }
.icon-black { width: 30px; height: 30px; background-color: black; border-radius: 50%; cursor: pointer; }
</style>