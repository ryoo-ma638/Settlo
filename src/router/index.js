import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import FriendDetailView from '../views/FriendDetailView.vue' // チームが追加
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'
import EventViews from '@/views/EventViews.vue' // チームが追加

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/friend', name: 'friend', component: FriendView },
    { path: '/friend/:name', name: 'friend-detail', component: FriendDetailView },
    { path: '/payment', name: 'payment', component: MoneyPage },
    { path: '/mypage', name: 'mypage', component: MyPageView },
    // 🌟 NotificationView はコンポーネント化したので削除済み
    { path: '/make-event', name: 'make-event', component: MakeEventView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/event', name: 'event', component: EventViews },
    // router/index.js に追加
    {path: '/payment-detail/:id', // イベントIDなどで詳細を特定できるようにする
    name: 'PaymentDetail', component: () => import('../views/PaymentDetailView.vue')},
    {path: '/combined-settlement/:name', name: 'CombinedSettlement', component: () => import('../views/CombinedSettlementView.vue')},
    {path: '/combined-action/:name',name: 'CombinedAction',component: () => import('../views/CombinedActionView.vue')}
  ]
})

export default router