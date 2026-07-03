<template>
    <div class="action-container">
      <PageHeader title="トータル精算" />
  
      <main class="content">
        <div class="summary-card" :class="isRemind ? 'blue-mode' : 'orange-mode'">
          <p class="summary-label">{{ $route.params.name }} さん{{ isRemind ? 'へ請求する' : 'に支払う' }}金額</p>
          <h2 class="total-amount">¥{{ Number($route.query.amount).toLocaleString() }}</h2>
          <p class="hint-badge">複数の貸し借りを相殺した金額です</p>
        </div>
  
        <section class="action-section">
        <h3 class="section-sub">{{ isRemind ? '相手に請求する' : 'アプリで決済' }}</h3>
        <PayPayAction :mode="isRemind ? 'remind' : 'pay'" :opponentUid="targetUid" />
      </section>


  
        <footer class="footer-actions">
          <h3 class="section-sub">手渡しの場合</h3>
          <button class="method-btn cash" @click="confirmCash">
            {{ isRemind ? '現金で受け取った (承認リクエスト)' : '現金で支払った (承認リクエスト)' }}
          </button>
        </footer>
      </main>
      <BaseModal 
        :show="modalState.show"
        :type="modalState.type"
        :title="modalState.title"
        :message="modalState.message"
        :showCancel="modalState.showCancel"
        :confirmText="modalState.confirmText"
        :cancelText="modalState.cancelText"
        @confirm="handleConfirm"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />
    </div>
  </template>
  
  <script setup>
  import { computed, reactive } from 'vue'; // 🌟 reactiveを追加
  import { useRoute, useRouter } from 'vue-router';
  import { db, auth } from '@/firebase';
  import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
  import PayPayAction from '../components/PayPayAction.vue';
  import BaseModal from '../components/BaseModal.vue';
  import PageHeader from '../components/PageHeader.vue';


  const route = useRoute();
  const router = useRouter();
  const isRemind = computed(() => route.query.type === 'remind');
  const amount = computed(() => route.query.amount);
  const targetUid = computed(() => route.query.uid);
  
  // 🌟 統一モーダルの状態管理
  const modalState = reactive({
    show: false, type: 'info', title: '', message: '', 
    showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
  });

  const showModal = (options) => {
    Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
  };

  const handleConfirm = () => {
    if (modalState.onConfirm) modalState.onConfirm();
    modalState.show = false;
  };
  
  // 🌟 confirm を美しいモーダルに！
  const confirmCash = () => {
    showModal({
      type: 'warning',
      title: '現金で精算',
      message: isRemind.value
        ? "この相手との貸し借りを現金で受け取って精算しますか？\nこの相手との未決済をすべて「完了」にします。"
        : "この相手との貸し借りを現金で支払って精算しますか？\nこの相手との未決済をすべて「完了」にします。",
      showCancel: true,
      confirmText: isRemind.value ? '受け取った' : '支払った',
      onConfirm: async () => {
        try {
          const myUid = auth.currentUser?.uid;
          const friendUid = route.query.uid;
          if (!myUid || !friendUid) {
            showModal({ type: 'error', title: 'エラー', message: '相手の情報が取得できませんでした。' });
            return;
          }
          // この相手との未決済取引（両方向）をすべて完了にする＝ネット精算
          const ids = new Set();
          const s1 = await getDocs(query(collection(db, "transactions"), where("paidToId", "==", myUid)));
          s1.forEach((d) => { const t = d.data(); if (t.paidById === friendUid && (t.status || 'unpaid') !== 'completed') ids.add(d.id); });
          const s2 = await getDocs(query(collection(db, "transactions"), where("paidById", "==", myUid)));
          s2.forEach((d) => { const t = d.data(); if (t.paidToId === friendUid && (t.status || 'unpaid') !== 'completed') ids.add(d.id); });

          const txIds = [...ids];
          for (const id of txIds) {
            await updateDoc(doc(db, "transactions", id), { status: 'completed' });
          }

          // 🌟 相手へ「精算が完了しました」を届ける
          if (txIds.length > 0) {
            try {
              await addDoc(collection(db, "notifications"), {
                toUserId: friendUid,
                fromUserId: myUid,
                fromUserName: auth.currentUser?.displayName || 'メンバー',
                type: 'payment_completed',
                message: `${ids.size}件の取引がまとめて精算されました。`,
                isRead: false,
                createdAt: serverTimestamp(),
              });
            } catch (e) { console.error('完了通知の送信に失敗:', e); }
          }

          // 🗑️ 間違えて精算した時のために、7日間はゴミ箱から「未精算に戻す」ことができるように（両当事者が見られる共有ゴミ箱）
          if (txIds.length > 0) {
            try {
              const friendName = route.params.name || '相手';
              await addDoc(collection(db, "trash"), {
                type: 'settlement',
                participants: [myUid, friendUid],
                createdBy: myUid,
                createdByName: auth.currentUser?.displayName || 'メンバー',
                trashedAt: serverTimestamp(),
                status: 'trashed',
                eventId: null,
                eventName: `${friendName}との精算`,
                historyId: null,
                itemName: `${friendName}との精算`,
                amount: Number(route.query.amount) || 0,
                transactionIds: txIds,
                counterparties: [{ uid: friendUid, name: friendName }],
              });
            } catch (e) { console.error('ゴミ箱への記録に失敗:', e); }
          }

          showModal({
            type: 'success', title: '精算完了',
            message: `${ids.size}件の取引を完了にしました！（ゴミ箱から7日以内なら戻せます）`,
            onConfirm: () => router.push('/')
          });
        } catch (e) {
          console.error("精算エラー:", e);
          showModal({ type: 'error', title: 'エラー', message: '精算に失敗しました。電波状況を確認してください。' });
        }
      }
    });
  };
  
  // 🌟 alert を美しいモーダルに！
  const createPayPayLink = () => {
    showModal({
      type: 'success',
      title: 'リンク作成完了',
      message: `¥${amount.value.toLocaleString()} のPayPay請求リンクを作成しました！\n相殺済みの金額です。`
    });
  };
  
  const confirmPayment = () => {
    showModal({ type: 'info', title: '準備中', message: 'PayPayアプリを起動します' });
  };
  </script>
  
<style scoped>
/* 🌟 overflow-x: hidden; を追加して横揺れを完全にブロック */
.action-container {
  background: var(--c-bg);
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.content {
  padding: 8px var(--pad) 28px;
  width: 100%;
  box-sizing: border-box;
}

.summary-card { padding: 24px; border-radius: var(--r-lg); color: white; text-align: center; margin-bottom: 22px; }
.blue-mode { background: var(--c-receive); }
.orange-mode { background: var(--c-pay); }
.summary-label { font-size: 14px; margin-bottom: 5px; opacity: 0.92; font-weight: var(--fw-medium); }
.total-amount { font-size: 40px; font-weight: var(--fw-black); margin: 0 0 10px 0; }
.hint-badge { background: rgba(255,255,255,0.22); display: inline-block; padding: 4px 12px; border-radius: var(--r-pill); font-size: 11px; font-weight: var(--fw-bold); }

.section-sub { font-size: 15px; font-weight: var(--fw-bold); margin: 18px 0 10px; color: var(--c-ink); }
.method-btn { width: 100%; padding: 16px; border-radius: var(--r-md); border: none; font-weight: var(--fw-bold); font-size: 16px; cursor: pointer; }
.cash { background-color: var(--c-brand); color: white; }
.paypay { background-color: #ff0033; color: white; }
.footer-actions { margin-top: 26px; }
</style>