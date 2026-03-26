import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import FriendDetailView from '../views/FriendDetailView.vue'
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
import NotificationView from '../views/NotificationView.vue'
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'
import EventViews from '@/views/EventViews.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/friend', name: 'friend', component: FriendView },
    { path: '/friend/:name', name: 'friend-detail', component: FriendDetailView },
    { path: '/payment', name: 'payment', component: MoneyPage },
    { path: '/mypage', name: 'mypage', component: MyPageView },
    { path: '/notification', name: 'notification', component: NotificationView },
    { path: '/make-event', name: 'make-event', component: MakeEventView },
    { path: '/login', name: 'login', component: LoginView }
    { path: '/event', name: 'event',component: EventViews}
  ]
})

export default router