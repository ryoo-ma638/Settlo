import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import MoneyPage from '../views/MoneyPage.vue'

// =========================================
// 【1】大崎さんのMyPageViewを読み込む
// =========================================
import MyPageView from '../views/MyPageView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/friend',
      name: 'friend',
      component: FriendView
    },
    {
      path: '/payment',
      name: 'payment',
      component: MoneyPage
    },
    
    // =========================================
    // 【2】「/mypage」用の道案内ルートを追加
    // =========================================
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPageView // 表示する画面
    }
  ]
})

export default router