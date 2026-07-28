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
          <button class="method-btn cash" :disabled="settling" @click="confirmCash">
            {{ isRemind ? '現金で受け取った（精算を完了）' : '現金で支払った（相手に承認を依頼）' }}
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
        :withReason="modalState.withReason"
        :reasonPlaceholder="modalState.reasonPlaceholder"
        @confirm="handleConfirm"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />
    </div>
  </template>
  
  <script setup>
  import { computed, reactive, ref } from 'vue'; // 🌟 reactiveを追加
  import { useRoute, useRouter } from 'vue-router';
  import { db, auth } from '@/firebase';
  import { collection, query, where, getDocs, getDoc, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
  import PayPayAction from '../components/PayPayAction.vue';
  import BaseModal from '../components/BaseModal.vue';
  import PageHeader from '../components/PageHeader.vue';
  import { resolveThreadForTx, postPaymentEventByTx } from '@/lib/thread';
  import { getMyName } from '@/lib/userName';


  const route = useRoute();
  const router = useRouter();
  const isRemind = computed(() => route.query.type === 'remind');
  const amount = computed(() => route.query.amount);
  const targetUid = computed(() => route.query.uid);
  const settling = ref(false); // 🌟 まとめて精算の二重送信ガード（完了通知・ゴミ箱記録の重複を防ぐ）
  
  // 🌟 統一モーダルの状態管理
  const modalState = reactive({
    show: false, type: 'info', title: '', message: '',
    showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null,
    withReason: false, reasonPlaceholder: ''
  });

  const showModal = (options) => {
    Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, withReason: false, reasonPlaceholder: '', ...options, show: true });
  };

  const handleConfirm = (reason) => {
    if (modalState.onConfirm) modalState.onConfirm(reason);
    modalState.show = false;
  };
  
  // 🌟 confirm を美しいモーダルに！
  const confirmCash = () => {
    showModal({
      type: 'warning',
      title: '現金で精算',
      message: isRemind.value
        ? "現金を受け取りましたか？\n選んだ取引をまとめて「完了」にします。"
        : "現金を支払いましたか？\n相手に承認をお願いし、相手が承認すると「完了」になります。",
      showCancel: true,
      confirmText: isRemind.value ? '受け取った' : '支払った',
      withReason: true,
      reasonPlaceholder: '相手へのひとこと（任意・お礼など）',
      onConfirm: async (reason) => {
        if (settling.value) return; // 🌟 確定ボタン連打による重複精算を防ぐ
        settling.value = true;
        try {
          const myUid = auth.currentUser?.uid;
          const friendUid = route.query.uid;
          if (!myUid || !friendUid) {
            showModal({ type: 'error', title: 'エラー', message: '相手の情報が取得できませんでした。' });
            return;
          }
          const friendName = route.params.name || '相手';
          const myName = await getMyName();

          // 🌟 精算対象の取引ID＝前画面で「含める」を選んだものだけ（＝除外を反映）
          let ids = String(route.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
          // フォールバック：ids未指定（古いリンク等）は相手との未決済を全件
          if (ids.length === 0) {
            const set = new Set();
            const s1 = await getDocs(query(collection(db, "transactions"), where("paidToId", "==", myUid)));
            s1.forEach((d) => { const t = d.data(); if (t.paidById === friendUid && (t.status || 'unpaid') !== 'completed') set.add(d.id); });
            const s2 = await getDocs(query(collection(db, "transactions"), where("paidById", "==", myUid)));
            s2.forEach((d) => { const t = d.data(); if (t.paidToId === friendUid && (t.status || 'unpaid') !== 'completed') set.add(d.id); });
            ids = [...set];
          }
          // 検証：当事者間の未完了取引だけに絞る（不正なIDや完了済みを除外）＋向きを記録
          //   iOwe=true … 自分が払う（paidById===自分）／false … 相手が自分に払う（paidToId===自分）
          const valid = [];
          for (const id of ids) {
            try {
              const snap = await getDoc(doc(db, "transactions", id));
              if (!snap.exists()) continue;
              const t = snap.data();
              const iOwe = t.paidById === myUid && t.paidToId === friendUid;
              const owedToMe = t.paidById === friendUid && t.paidToId === myUid;
              if ((iOwe || owedToMe) && (t.status || 'unpaid') !== 'completed') valid.push({ id, iOwe });
            } catch (e) { /* 取得できないIDはスキップ */ }
          }
          if (valid.length === 0) {
            showModal({ type: 'info', title: '対象がありません', message: '精算できる未決済の取引が見つかりませんでした。' });
            return;
          }

          if (isRemind.value) {
            // ■ 自分が受け取る側＝現金を受け取った本人が確認するので、選んだ取引をその場で完了にする
            const done = valid.map((v) => v.id);
            for (const id of done) {
              await updateDoc(doc(db, "transactions", id), { status: 'completed' });
              // 支払いのチャットに経緯を残す（相手の未読が点く）
              await postPaymentEventByTx(id, { text: `${myName}さんがまとめて受け取り、精算しました`, kind: 'completed', actorUid: myUid });
              await resolveThreadForTx(myUid, friendUid, id); // 解決したのでチャットを消す
            }
            try {
              await addDoc(collection(db, "notifications"), {
                toUserId: friendUid, fromUserId: myUid, fromUserName: myName,
                type: 'payment_completed',
                message: `${myName}さんが${done.length}件をまとめて精算しました。`,
                userMessage: reason || null,
                isRead: false, createdAt: serverTimestamp(),
              });
            } catch (e) { console.error('完了通知の送信に失敗:', e); }
            showModal({
              type: 'success', title: '精算完了',
              message: `${done.length}件を精算済みにしました。お支払い履歴から確認できます。`,
              onConfirm: () => router.push('/')
            });
          } else {
            // ■ 自分が支払う側＝
            //   ・自分が債権者の分（相手→自分）は受領扱いで即完了（自分の権限）
            //   ・自分が債務者の分（自分→相手）は相手の承認待ちにして、まとめ承認リクエストを送る
            const iOweIds = valid.filter((v) => v.iOwe).map((v) => v.id);
            const owedToMeIds = valid.filter((v) => !v.iOwe).map((v) => v.id);
            for (const id of owedToMeIds) {
              await updateDoc(doc(db, "transactions", id), { status: 'completed' });
              await postPaymentEventByTx(id, { text: `${myName}さんがまとめて受け取り、精算しました`, kind: 'completed', actorUid: myUid });
              await resolveThreadForTx(myUid, friendUid, id);
            }
            for (const id of iOweIds) {
              await updateDoc(doc(db, "transactions", id), { status: 'awaiting_approval' });
              await postPaymentEventByTx(id, { text: `${myName}さんがまとめて支払いました（相手の承認待ち）`, kind: 'paid', actorUid: myUid });
            }
            if (iOweIds.length) {
              try {
                await addDoc(collection(db, "notifications"), {
                  toUserId: friendUid, fromUserId: myUid, fromUserName: myName,
                  type: 'approval_request',
                  batch: true, transactionIds: iOweIds, count: iOweIds.length,
                  // 🌟 双方向のときに「その場で完了」にした逆方向の取引（相手→自分）を記録しておく。
                  //    拒否されたら、この分も未払いに戻して片側だけ完了で残らないようにする。
                  counterTransactionIds: owedToMeIds,
                  itemName: `${friendName}との精算`,
                  amount: Number(route.query.amount) || 0,
                  message: 'まとめて精算の承認リクエストが届きました。',
                  userMessage: reason || null,
                  isRead: false, createdAt: serverTimestamp(),
                });
              } catch (e) { console.error('承認リクエストの送信に失敗:', e); }
              showModal({
                type: 'success', title: '承認待ちにしました',
                message: owedToMeIds.length
                  ? `${iOweIds.length}件の精算リクエストを送信しました。相手が承認すると完了します。\n受け取る${owedToMeIds.length}件も、拒否された場合は未払いに戻ります。`
                  : `${iOweIds.length}件の精算リクエストを送信しました。相手が承認すると完了します。`,
                onConfirm: () => router.push('/')
              });
            } else {
              // すべて「相手が自分に払う」分だった＝実質その場で完了
              showModal({
                type: 'success', title: '精算完了',
                message: `${owedToMeIds.length}件を精算済みにしました。お支払い履歴から確認できます。`,
                onConfirm: () => router.push('/')
              });
            }
          }
        } catch (e) {
          console.error("精算エラー:", e);
          showModal({ type: 'error', title: 'エラー', message: '精算に失敗しました。電波状況を確認してください。' });
        } finally {
          settling.value = false;
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
.method-btn:disabled { opacity: 0.5; cursor: default; }
.cash { background-color: var(--c-brand); color: white; }
.paypay { background-color: var(--c-paypay); color: white; }
.footer-actions { margin-top: 26px; }
</style>