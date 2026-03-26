<template>
  <div class="money-page-container">
    <div class="tab-container">
      <button
        class="tab-btn"
        :class="{ active: currentTab === 'waiting' }"
        @click="currentTab = 'waiting'"
      >
        入金待ち
      </button>
      <button
        class="tab-btn"
        :class="{ active: currentTab === 'unpaid' }"
        @click="currentTab = 'unpaid'"
      >
        未払い
      </button>
    </div>

    <div v-if="currentTab === 'waiting'" class="tab-content">
      <div class="card summary-card blue-bg">
        <p class="summary-title">現在の入金待ち</p>
        <h1 class="summary-amount">¥ 12,450</h1>
        <div class="badge">△ 3件の入金待ち</div>
      </div>

      <h2 class="section-title">入金待ち詳細</h2>

      <div v-for="item in receivableList" :key="item.id" class="card list-card">
        <div class="list-left">
          <p class="date">{{ item.date }}</p>
          <div class="circle" :style="{ backgroundColor: item.color }"></div>
          <div class="info">
            <p class="name">{{ item.name }}</p>
            <p class="event">{{ item.itemName }}</p>
          </div>
        </div>
        <div class="list-right">
          <p class="amount red-text">¥{{ item.amount.toLocaleString() }}</p>
          <button class="btn btn-green" @click="$router.push('/payment-detail/waiting-' + item.id)">
            催促する
          </button>
        </div>
      </div>
    </div>

    <div v-if="currentTab === 'unpaid'" class="tab-content">
      <div class="card summary-card orange-bg">
        <p class="summary-title">現在の未払い</p>
        <h1 class="summary-amount">¥ 8,300</h1>
        <div class="badge">△ 2件の未支払い</div>
      </div>

      <h2 class="section-title">支払い詳細</h2>

      <div v-for="item in payableList" :key="item.id" class="card list-card">
        <div class="list-left">
          <p class="date">{{ item.date }}</p>
          <div class="circle" :style="{ backgroundColor: item.color }"></div>
          <div class="info">
            <p class="name">{{ item.name }}</p>
            <p class="event">{{ item.itemName }}</p>
          </div>
        </div>
        <div class="list-right">
          <p class="amount red-text">¥{{ item.amount.toLocaleString() }}</p>
          <button class="btn btn-red" @click="$router.push('/payment-detail/unpaid-' + item.id)">
            支払いを完了させる
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const currentTab = ref('waiting') // デフォルトを左側の「入金待ち」にする

// 🌟 URLパラメータ (?tab=xxx) に応じて開くタブを切り替える
onMounted(() => {
  if (route.query.tab) {
    currentTab.value = route.query.tab
  }
})

// タブを切り替えずにパラメーターだけ変わった時にも対応
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    currentTab.value = newTab
  }
})

// --- ダミーデータ ---
const payableList = ref([
  { id: 1, date: '3/10', name: '小野木涼平', itemName: 'レンタカー代', amount: 2000, color: '#fca5a5' },
  { id: 2, date: '3/11', name: '大崎稜馬', itemName: '飲み会代', amount: 6300, color: '#93c5fd' },
])

const receivableList = ref([
  { id: 1, date: '3/12', name: '天野椋祐', itemName: 'カフェ代', amount: 800, color: '#93c5fd' },
  { id: 2, date: '3/14', name: '中橋楓華', itemName: 'ランチ代', amount: 1200, color: '#bbf7d0' },
  { id: 3, date: '3/15', name: '松岡暖來', itemName: 'タクシー代', amount: 1500, color: '#f9a8d4' },
])
</script>

<style scoped>
.money-page-container { font-family: 'Noto Sans JP', sans-serif; background-color: #f0f4f8; padding: 20px; min-height: 100vh; }
.tab-container { display: flex; background-color: #e2e8f0; border-radius: 8px; padding: 4px; margin-bottom: 20px; }
.tab-btn { flex: 1; padding: 10px; border: none; background: transparent; font-weight: bold; color: #64748b; border-radius: 6px; cursor: pointer; transition: all 0.3s ease; }
.tab-btn.active { background-color: #fff; color: #0f172a; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }

.card { background-color: #fff; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02); }
.summary-card { text-align: left; }
.blue-bg { background-color: #2563eb; color: #fff; }

/* 🌟 追加: オレンジ系の背景設定 */
.orange-bg { background-color: #f59e0b; color: #fff; }

.summary-title { margin: 0; font-size: 14px; opacity: 0.9; }
.summary-amount { margin: 10px 0; font-size: 36px; font-weight: bold; }
.badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; }

.section-title { font-size: 18px; font-weight: bold; margin: 25px 0 15px 0; color: #1e293b; }

.list-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; }
.list-left { display: flex; align-items: center; gap: 15px; }
.date { font-size: 14px; font-weight: bold; color: #000; margin: 0; }
.circle { width: 30px; height: 30px; border-radius: 50%; }
.info p { margin: 0; }
.name { font-size: 12px; font-weight: bold; color: #000; }
.event { font-size: 10px; color: #64748b; }
.list-right { text-align: center; }
.amount { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
.red-text { color: #b91c1c; }

.btn { padding: 6px 16px; border-radius: 20px; border: none; font-size: 12px; font-weight: bold; color: #fff; cursor: pointer; }
.btn-red { background-color: #ef4444; }
.btn-green { background-color: #4ade80; }
</style>