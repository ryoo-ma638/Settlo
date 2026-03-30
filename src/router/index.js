import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import FriendDetailView from '../views/FriendDetailView.vue' // チームが追加
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'
import EventViews from '../views/EventViews.vue' // チームが追加
import EventDetails from '../views/EventDetails.vue' 
import EditProfileView from '../views/EditProfileView.vue';
import PaymentHistoryView from '../views/PaymentHistoryView.vue';

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
    
    // 🌟 チームメンバーが追加したルート
    { path: '/event-detail', name: 'event-detail', component: EventDetails },
    
    // 🌟 大崎さんが追加した決済・精算関連のルート
    { path: '/payment-detail/:id', name: 'PaymentDetail', component: () => import('../views/PaymentDetailView.vue') },
    { path: '/combined-settlement/:name', name: 'CombinedSettlement', component: () => import('../views/CombinedSettlementView.vue') },
    { path: '/combined-action/:name', name: 'CombinedAction', component: () => import('../views/CombinedActionView.vue') },
    { path: '/edit-profile', name: 'EditProfile', component: EditProfileView },

    { path: '/payment-history', name: 'PaymentHistory', component: PaymentHistoryView },
    // router/index.js の routes 配列の中
    {path: '/event/:id',name: 'EventDetails',component: () => import('../views/EventDetails.vue')}
  ]
})

export default router