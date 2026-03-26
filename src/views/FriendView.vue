<template>
  <div class="friend-container">
    <main class="content">
      <div class="fixed-top-items">
        <button class="add-friend-main-button" @click="isModalOpen = true">
          友達を追加する
        </button>
        
        <div class="request-section" v-if="pendingRequests.length > 0">
          <p class="request-alert">❗ 友達申請が届いています</p>
          <div class="request-card" v-for="req in pendingRequests" :key="req.id">
            <div class="request-avatar blue-avatar" :style="{ backgroundColor: req.color }"></div>
            <span class="request-name">{{ req.name }}</span>
            <button class="approve-button" @click="openApproveModal(req)">確認</button>
          </div>
        </div>

    <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
    <FriendApproveModal 
      :isOpen="isApproveModalOpen" 
      :requestUser="selectedRequestUser" 
      @close="isApproveModalOpen = false" 
      @approve="handleApproveDone" 
    />

        <div class="list-header-row">
          <h2 class="list-title">友達リスト</h2>
        </div>

        <div class="control-panel">
          <select v-model="currentFilter" class="custom-select">
            <option value="all">すべて表示</option>
            <option value="trading">取引中</option>
            <option value="not_friend">取引あり（未フレンド）</option>
          </select>
          <select v-model="currentSort" class="custom-select">
            <option value="added_desc">追加順</option>
            <option value="kana_asc">あいうえお順</option>
            <option value="trade_desc">取引多い順</option>
          </select>
        </div>
      </div>
      
      <div class="friend-scroll-area">
        <FriendCard 
          v-for="user in processedList" 
          :key="user.id" 
          :user="user" 
          @click="navigateToDetail(user)" 
        />
        <p v-if="processedList.length === 0" class="empty-msg">該当するユーザーがいません。</p>
      </div>
    </main>

    <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import FriendAddModal from '@/components/FriendAddModal.vue'
import FriendCard from '@/components/FriendCard.vue' // 🌟 追加
// 🌟 <script setup> に追加する処理
import FriendApproveModal from '@/components/FriendApproveModal.vue' // インポートを追加

const router = useRouter()
const isModalOpen = ref(false)

const currentFilter = ref('all')
const currentSort = ref('added_desc')


// 🌟 ダミーデータ（テスト用にフィルターがかかるよう情報を追加）
const friendData = ref([
  { id: 1, name: '天野 椋祐', kana: 'アマノ リョウスケ', color: '#ff9980', isFriend: true, isTrading: true, tradeCount: 5, addedAt: '2026-03-20' },
  { id: 2, name: '小野木 涼平', kana: 'オノギ リョウヘイ', color: '#ffee10', isFriend: true, isTrading: false, tradeCount: 12, addedAt: '2025-12-10' },
  { id: 3, name: '大崎 稜馬', kana: 'オオサキ リョウマ', color: '#ff0000', isFriend: false, isTrading: true, tradeCount: 2, addedAt: '' },
  { id: 4, name: '中橋 楓華', kana: 'ナカハシ フウカ', color: '#889900', isFriend: true, isTrading: true, tradeCount: 8, addedAt: '2026-01-15' },
])
// 申請がきているユーザーのダミーデータ
const pendingRequests = ref([
  { id: 101, name: 'テスト 太郎', color: '#a0aec0' }
]);
// 承認モーダル用の状態管理
const isApproveModalOpen = ref(false);
const selectedRequestUser = ref(null);

// 確認ボタンを押した時
const openApproveModal = (user) => {
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
};

// モーダル内で「承認する」が実行された後の処理
const handleApproveDone = (approvedUser) => {
  // 承認された人を「申請一覧」から消す（ダミー処理）
  pendingRequests.value = pendingRequests.value.filter(u => u.id !== approvedUser.id);
};

const processedList = computed(() => {
  let list = friendData.value;
  if (currentFilter.value === 'trading') list = list.filter(u => u.isTrading);
  else if (currentFilter.value === 'not_friend') list = list.filter(u => !u.isFriend);
  
  return [...list].sort((a, b) => {
    if (currentSort.value === 'kana_asc') return a.kana.localeCompare(b.kana, 'ja');
    if (currentSort.value === 'trade_desc') return b.tradeCount - a.tradeCount;
    if (currentSort.value === 'added_desc') return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
    return 0;
  });
});

const navigateToDetail = (friend) => {
  router.push(`/friend/${encodeURIComponent(friend.name)}`)
}
</script>

<style scoped>
.friend-container { min-height: 100vh; background-color: #eef7ff; }
.content { padding: 20px 20px 100px 20px; box-sizing: border-box; }
.fixed-top-items { margin-bottom: 10px; }

.add-friend-main-button { width: 100%; padding: 12px; background-color: #2169a3; color: white; border: none; border-radius: 25px; font-size: 18px; font-weight: bold; margin-bottom: 25px; cursor: pointer; }
.request-alert { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #ef4444; }
.request-card { background-color: white; display: flex; align-items: center; padding: 10px 20px; border-radius: 40px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.blue-avatar { background-color: #8bb4ff; width: 35px; height: 35px; border-radius: 50%; margin-right: 15px; }
.request-name { flex: 1; font-size: 18px; font-weight: bold; }
.approve-button { background-color: #ffedb3; border: none; padding: 8px 30px; border-radius: 20px; font-weight: bold; cursor: pointer; }

.list-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.list-title { font-size: 20px; font-weight: bold; margin: 0; }

.control-panel { display: flex; gap: 10px; margin-bottom: 15px; }
.custom-select { flex: 1; padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1; background-color: white; font-size: 12px; font-weight: bold; color: #1e293b; outline: none; }

.friend-scroll-area { display: flex; flex-direction: column; gap: 12px; }
.empty-msg { text-align: center; color: #64748b; font-weight: bold; margin-top: 40px; }
</style>