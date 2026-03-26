import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
// お知らせ画面とイベント作成画面をインポート
import NotificationView from '../views/NotificationView.vue'
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

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
      component: NotificationView
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

router.beforeEach((to, from) => {
  // 1. 現在のユーザー情報を取得
  const user = auth.currentUser;

  // 2. もし未ログイン かつ ログイン画面以外に行こうとしているなら
  if (!user && to.path !== "/login") {
    // ログイン画面へ強制送還
    return "/login";
  }

  // 3. ログイン済み、またはログイン画面へ行くならそのまま通す
  return true;
});

export default router