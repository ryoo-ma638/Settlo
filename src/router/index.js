// 🌟 修正：createWebHistory を createWebHashHistory に変更！
import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import FriendView from '../views/FriendView.vue'
import FriendDetailView from '../views/FriendDetailView.vue' 
import MoneyPage from '../views/MoneyPage.vue'
import MyPageView from '../views/MyPageView.vue'
import MakeEventView from '../views/MakeEventView.vue'
import LoginView from '../views/LoginView.vue'
import EventViews from '../views/EventViews.vue' 
import EventDetails from '../views/EventDetails.vue' 
import EditProfileView from '../views/EditProfileView.vue';
import PaymentHistoryView from '../views/PaymentHistoryView.vue';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/friend', name: 'friend', component: FriendView },
    { path: '/friend/:name/:uid', name: 'friend-detail', component: FriendDetailView },
    { path: '/payment', name: 'payment', component: MoneyPage },
    { path: '/mypage', name: 'mypage', component: MyPageView },
    { path: '/make-event', name: 'make-event', component: MakeEventView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/event', name: 'event', component: EventViews },
    
    // チームメンバーが追加したルート
    { path: '/event-detail', name: 'event-detail', component: EventDetails },
    
    // 大崎さんが追加した決済・精算関連のルート
    { path: '/payment-detail/:id', name: 'PaymentDetail', component: () => import('../views/PaymentDetailView.vue') },
    { path: '/combined-settlement/:name', name: 'CombinedSettlement', component: () => import('../views/CombinedSettlementView.vue') },
    { path: '/combined-action/:name', name: 'CombinedAction', component: () => import('../views/CombinedActionView.vue') },
    { path: '/edit-profile', name: 'EditProfile', component: EditProfileView },

    { path: '/payment-history', name: 'PaymentHistory', component: PaymentHistoryView },
    { path: '/trash', name: 'Trash', component: () => import('../views/TrashView.vue') },
    { path: '/help', name: 'Help', component: () => import('../views/HelpView.vue') },
    { path: '/approvals', name: 'Approvals', component: () => import('../views/PendingApprovalsView.vue') },
    { path: '/chats', name: 'Chats', component: () => import('../views/ChatListView.vue') },
    { path: '/chats/:uid', name: 'PersonChats', component: () => import('../views/PersonChatsView.vue') },
    { path: '/thread/:id', name: 'Thread', component: () => import('../views/ThreadView.vue') },
    { path: '/event/:id', name: 'EventDetails', component: () => import('../views/EventDetails.vue') }
  ]
})

// 🌟 遅延読み込みチャンクの取得失敗（デプロイでファイル名が変わり、開きっぱなしのタブが
//    古いチャンクを参照）→ 画面遷移が無反応になるので、一度だけ自動リロードして復帰する。
//    無限ループを避けるため、直近10秒以内にリロード済みなら何もしない。
router.onError((error, to) => {
  const msg = (error && error.message) || '';
  const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg);
  if (!isChunkError) return;
  try {
    const KEY = 'settlo_chunk_reload_at';
    const now = Date.now();
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (now - last < 10000) return; // 直近でリロード済み＝これ以上は繰り返さない
    sessionStorage.setItem(KEY, String(now));
    if (to && to.fullPath) window.location.hash = to.fullPath; // 目的の画面に着地させる
  } catch (e) { /* sessionStorage 不可でもリロードは行う */ }
  window.location.reload();
});

export default router