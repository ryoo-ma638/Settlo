import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
// お知らせ画面とイベント作成画面をインポート
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'

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
    {
      path: '/mypage',
      name: 'mypage',
      component: MyPageView
    },
    // お知らせ画面のルート
    {
      path: '/notification',
      name: 'notification',
    },
    // 新規イベント作成画面のルート
    {
      path: '/make-event',
      name: 'make-event',
      component: MakeEventView
    },
    // 🌟 復活！ログイン画面のルート
    { 
      path: '/login',
      name: 'login',
     component: LoginView 
    }   
  ]
})

export default router