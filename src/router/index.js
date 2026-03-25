import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import MoneyPage from '../views/MoneyPage.vue'

// =========================================
// 【1】大崎さんの追加ページを読み込む
// =========================================
import MyPageView from '../views/MyPageView.vue'
import LoginView from '../views/LoginView.vue' // 🌟ここに追加！ログイン画面を読み込む

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
    // 【2】追加ページの道案内ルート
    // =========================================
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPageView // マイページを表示
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView // 🌟ここに追加！ログイン画面を表示
    }
  ]
})

export default router