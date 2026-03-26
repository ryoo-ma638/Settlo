<template>
  <div class="friend-container">
    <main class="content">
      <div class="fixed-top-items">
        <button class="add-friend-main-button" @click="isModalOpen = true">
          友達を追加する
        </button>
        
        <div class="request-section">
          <p class="request-alert">❗ 友達申請が届いています</p>
          <div class="request-card">
            <div class="request-avatar blue-avatar"></div>
            <span class="request-name">名前</span>
            <button class="approve-button">承認</button>
          </div>
        </div>

        <h2 class="list-title">友達リスト</h2>
      </div>
      
      <div class="friend-scroll-area">
        <div 
          class="friend-card" 
          v-for="(friend, index) in friendData" 
          :key="index"
          @click="navigateToDetail(friend)"
        >
          <div class="friend-avatar" :style="{ backgroundColor: friend.color }"></div>
          <span class="friend-name-text">{{ friend.name }}</span>
        </div>
      </div>
    </main>

    <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
// 🌟 インポートを確認
import FriendAddModal from '@/components/FriendAddModal.vue'

const router = useRouter()
// 🌟 モーダルの状態管理
const isModalOpen = ref(false)

const friendData = [
  { name: '天野 椋祐', color: '#ff9980' },
  { name: '小野木 涼平', color: '#ffee10' },
  { name: '大崎 稜馬', color: '#ff0000' },
  { name: '中橋 楓華', color: '#889900' },
  { name: '松岡 暖來', color: '#776666' },
  { name: 'テスト 太郎', color: '#a0aec0' },
]

const navigateToDetail = (friend) => {
  router.push(`/friend/${encodeURIComponent(friend.name)}`)
}
</script>

<style scoped>
.friend-container { height: calc(100vh - 160px); background-color: #eef7ff; }
.content { padding: 20px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
.fixed-top-items { flex-shrink: 0; }
.add-friend-main-button { width: 100%; padding: 12px; background-color: #2169a3; color: white; border: none; border-radius: 25px; font-size: 18px; font-weight: bold; margin-bottom: 25px; cursor: pointer; }
.request-alert { font-weight: bold; font-size: 18px; margin-bottom: 10px; }
.request-card { background-color: white; display: flex; align-items: center; padding: 10px 20px; border-radius: 40px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.blue-avatar { background-color: #8bb4ff; width: 35px; height: 35px; border-radius: 50%; margin-right: 15px; }
.request-name { flex: 1; font-size: 18px; font-weight: bold; }
.approve-button { background-color: #ffedb3; border: none; padding: 8px 30px; border-radius: 20px; font-weight: bold; cursor: pointer; }
.list-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; }
.friend-scroll-area { flex: 1; overflow-y: auto; padding-bottom: 10px; scrollbar-width: none; }
.friend-scroll-area::-webkit-scrollbar { display: none; }
.friend-card { background-color: white; display: flex; align-items: center; padding: 12px 25px; border-radius: 50px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; }
.friend-avatar { width: 45px; height: 45px; border-radius: 50%; margin-right: 20px; flex-shrink: 0; }
.friend-name-text { font-size: 24px; font-weight: bold; color: #333; }
</style>