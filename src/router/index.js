import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
import NotificationView from '../views/NotificationView.vue'

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
    // 【追加ポイント2】お知らせ画面への道（ルート）を追加
    {
      path: '/notification',
      name: 'notification',
      component: NotificationView
    }
  ]
})

export default router