<template>
  <div class="payment-detail-container">
    <PageHeader :title="pageTitle" />

    <main class="content">
      <div v-if="loading" class="state-msg">情報を取得中…</div>

      <template v-else-if="items.length > 0">
        <div class="summary-card" :class="modeClass">
          <p class="summary-label">{{ modeLabel }}</p>
          <h2 class="total-amount">¥{{ totalAmount.toLocaleString() }}</h2>
          <p v-if="isBatch" class="count-badge">内訳: {{ items.length }}件</p>
          <p v-if="remindCount > 0" class="remind-status">催促 {{ remindCount }}回 送信済み<template v-if="lastRemindedText">・最終 {{ lastRemindedText }}</template></p>
        </div>

        <PaymentReceipt v-if="!isBatch" :item="items[0]" />
        <BatchItemList v-else :items="items" @select="openOverlay" />

        <template v-if="!isCompleted">
          <!-- 🌟 承認待ちの状態を「誰待ちか」はっきり表示 -->
          <div v-if="isAwaitingApproval" class="await-banner" :class="{ 'await-banner--action': mode === 'remind' }">
            <span class="await-banner__icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </span>
            <div class="await-banner__body">
              <template v-if="mode === 'remind'">
                <p class="await-banner__title">{{ opponentName }}さんが「支払い済み」にしました</p>
                <p class="await-banner__text">内容を確認し、下の「承認して完了にする」を押すと精算が完了します。</p>
              </template>
              <template v-else>
                <p class="await-banner__title">{{ opponentName }}さんの承認待ちです</p>
                <p class="await-banner__text">承認リクエストを送信済みです。相手が承認すると精算が完了します。</p>
              </template>
            </div>
          </div>

          <section v-if="!isAwaitingApproval" class="action-section">
            <h3 class="section-sub">{{ mode === 'remind' ? '相手に請求する' : 'アプリで決済' }}</h3>
            <PayPayAction :mode="mode" :opponentUid="targetUid" />
            <button v-if="mode === 'remind'" class="method-btn remind-btn" :disabled="submitting" @click="openRemind">
              支払いを催促する{{ alreadyReminded ? `（送信済み ${remindCount}回）` : '（通知を送る）' }}
            </button>
          </section>

          <footer class="footer-actions">
            <h3 v-if="!isAwaitingApproval" class="section-sub">手渡しの場合</h3>

            <!-- 受け取る側：承認待ち → 承認 or 拒否 -->
            <template v-if="mode === 'remind' && isAwaitingApproval">
              <button class="method-btn approve" :disabled="submitting" @click="approvePayment">
                承認して完了にする
              </button>
              <button class="method-btn reject" :disabled="submitting" @click="rejectPayment">
                リクエストを拒否する
              </button>
            </template>

            <!-- 支払う側：承認待ち → 押せない（二重送信防止） -->
            <button v-else-if="mode === 'pay' && isAwaitingApproval" class="method-btn disabled-btn" disabled>
              {{ opponentName }}さんの承認待ち
            </button>

            <button v-else class="method-btn cash" :disabled="submitting" @click="confirmCash">
              {{ mode === 'remind' ? '受け取った (完了にする)' : '支払った (承認リクエスト)' }}
            </button>
          </footer>
        </template>
        
        <section v-else class="completed-section">
          <div class="completed-card">
            <span class="completed-icon"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#059669" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>
            <h3 class="completed-title">この取引は完了しています</h3>
            <p class="completed-date">すべての精算が終了しました。</p>
          </div>
        </section>
      </template>

      <div v-else class="empty-box">該当するお支払い情報が見つかりませんでした</div>
    </main>

    <Teleport to="body">
      <div v-if="selectedItem" class="overlay" @click.self="selectedItem = null">
        <div class="overlay-content">
          <button class="close-overlay" @click="selectedItem = null" aria-label="閉じる">×</button>
          <PaymentReceipt :item="selectedItem" />
          <button class="main-btn" @click="selectedItem = null">閉じる</button>
        </div>
      </div>

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
        @confirm="handleConfirmModal"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />

      <RemindModal :isOpen="remindModalOpen" @close="remindModalOpen = false" @send="sendReminder" />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router'; 
import { db, auth } from '@/firebase'; 
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, increment } from 'firebase/firestore';
import PaymentReceipt from '../components/PaymentReceipt.vue';
import BatchItemList from '../components/BatchItemList.vue';
import PayPayAction from '../components/PayPayAction.vue';
import BaseModal from '../components/BaseModal.vue';
import RemindModal from '../components/RemindModal.vue';
import PageHeader from '../components/PageHeader.vue';
import { logApprovalBoth } from '@/lib/approvalLog';
import { resolveThreadForTx, postPaymentEventByTx, resolvePaymentThreadByTx } from '@/lib/thread';
import { getMyName } from '@/lib/userName';
import { findBatchApprovalRequests, revertCounterTransactions, COUNTER_REVERT_TEXT } from '@/lib/settlement';

const route = useRoute();
const router = useRouter(); 
const selectedItem = ref(null);
const items = ref([]); 
const loading = ref(true);
const targetUid = ref(''); 

// 🌟 取引のステータスをデータベースから取得して保持する変数
const currentStatus = ref('unpaid');
// 二重送信を防ぐためのフラグ（リクエスト連打→エラー対策）
const submitting = ref(false);
// 催促モーダルの開閉
const remindModalOpen = ref(false);

// 🌟 URLパラメータではなく、実際のデータベースのステータスを見て判断する！
const isCompleted = computed(() => currentStatus.value === 'completed');
const isAwaitingApproval = computed(() => currentStatus.value === 'awaiting_approval');

const modalState = reactive({
  show: false, type: 'info', title: '', message: '',
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null,
  withReason: false, reasonPlaceholder: ''
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, withReason: false, reasonPlaceholder: '', ...options, show: true });
};
const handleConfirmModal = (reason) => {
  if (modalState.onConfirm) modalState.onConfirm(reason);
  modalState.show = false;
};

const mode = computed(() => {
  const id = route.params.id || '';
  return id.includes('waiting') ? 'remind' : 'pay';
});

const isBatch = computed(() => route.params.id?.includes('batch') || route.params.id === 'all' || route.params.id?.includes('event'));
const modeLabel = computed(() => mode.value === 'remind' ? 'ご請求合計' : 'お支払い合計');
const modeClass = computed(() => mode.value === 'remind' ? 'blue-mode' : 'orange-mode');
const totalAmount = computed(() => items.value.reduce((sum, i) => sum + (i.amount || 0), 0));
const opponentName = computed(() => items.value[0]?.name || '相手');
// 催促の送信回数（再送の確認や表示に使う）
const remindCount = computed(() => Math.max(0, ...items.value.map(i => i.remindCount || 0), 0));
const alreadyReminded = computed(() => remindCount.value > 0);
// 催促の最終送信日（立替履歴からの詳細でも催促状況が分かるように）
const lastRemindedText = computed(() => {
  let latest = 0;
  for (const it of items.value) { const s = it.lastRemindedAt?.seconds || 0; if (s > latest) latest = s; }
  if (!latest) return '';
  const d = new Date(latest * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
});

const pageTitle = computed(() => {
  if (mode.value === 'remind') {
    return route.params.id?.includes('event') ? 'イベントのまとめて受け取り' : (isBatch.value ? 'まとめて催促' : '催促の詳細');
  } else {
    return route.params.id?.includes('event') ? 'イベントのまとめてお支払い' : (isBatch.value ? 'まとめてお支払い' : 'お支払いの詳細');
  }
});

const transactionId = computed(() => {
  const idParam = route.params.id || '';
  return idParam.replace('waiting-', '').replace('unpaid-', '');
});

// 🌟 「まとめて（イベント単位）」かどうかと、その eventId
const isEventBatch = computed(() => (route.params.id || '').includes('event-'));
const eventBatchId = computed(() =>
  (route.params.id || '').replace('event-', '').replace('waiting-', '').replace('unpaid-', '')
);

onMounted(async () => {
  const myUid = auth.currentUser?.uid;
  try {
    if (isEventBatch.value) {
      // 🌟 「まとめて」：イベント内で自分が関わる未決済トランザクションを集計
      const eid = eventBatchId.value;
      if (!eid) { loading.value = false; return; }

      // 複合インデックスを避けるため eventId の単一条件で取得し、status はJSで絞る
      const qy = query(collection(db, "transactions"), where("eventId", "==", eid));
      const snap = await getDocs(qy);
      const list = [];
      for (const d of snap.docs) {
        const data = d.data();
        if ((data.status || 'unpaid') === 'completed') continue;
        // remind(受け取る)=自分が債権者(paidToId) / pay(支払う)=自分が債務者(paidById)
        const isMine = mode.value === 'remind' ? data.paidToId === myUid : data.paidById === myUid;
        if (!isMine) continue;

        const opponentUid = mode.value === 'remind' ? data.paidById : data.paidToId;
        // 特定の相手が指定されていれば、その相手の分だけにまとめる（全員合算を防ぐ）
        if (route.query.uid && opponentUid !== route.query.uid) continue;
        if (!targetUid.value) targetUid.value = opponentUid;

        let opponentName = "不明";
        if (opponentUid) {
          const us = await getDoc(doc(db, "users", opponentUid));
          if (us.exists()) opponentName = us.data().name || "不明";
        }

        list.push({
          id: d.id,
          opponentUid,
          eventName: data.eventName || data.itemName || '精算',
          date: fmtDate(data.createdAt),
          name: opponentName,
          itemName: data.itemName || 'イベント代',
          amount: data.amount || 0,
          remindCount: data.remindCount || 0,
          lastRemindedAt: data.lastRemindedAt || null,
          itemsDetail: data.itemsDetail || [data.itemName]
        });
      }
      items.value = list;
      currentStatus.value = 'unpaid';
    } else {
      // 🌟 単一トランザクション
      if (!transactionId.value) { loading.value = false; return; }

      const docRef = doc(db, "transactions", transactionId.value);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        currentStatus.value = data.status || 'unpaid';

        const opponentUid = mode.value === 'remind' ? data.paidById : data.paidToId;
        targetUid.value = opponentUid;

        let opponentName = "不明";
        if (opponentUid) {
          const userSnap = await getDoc(doc(db, "users", opponentUid));
          if (userSnap.exists()) opponentName = userSnap.data().name || "不明";
        }

        items.value = [{
          id: docSnap.id,
          opponentUid,
          eventName: data.eventName || data.itemName || '個別精算',
          date: fmtDate(data.createdAt),
          name: opponentName,
          itemName: data.itemName,
          amount: data.amount || 0,
          remindCount: data.remindCount || 0,
          lastRemindedAt: data.lastRemindedAt || null,
          itemsDetail: data.itemsDetail || [data.itemName]
        }];
      }
    }
  } catch (error) {
    console.error("詳細データの取得に失敗しました:", error);
  } finally {
    loading.value = false;
  }
});

const openOverlay = (item) => { selectedItem.value = item; };

// 取引のステータスを一括更新する共通処理
// 取引の作成日時を「YYYY/MM/DD」表示にする
const fmtDate = (ts) => (ts && ts.seconds)
  ? new Date(ts.seconds * 1000).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
  : '';

const updateAllItems = async (status) => {
  for (const it of items.value) {
    await updateDoc(doc(db, "transactions", it.id), { status });
  }
};

// 相手へ通知を送る（宛先が無ければスキップしてエラーを防ぐ）
const notifyOpponent = async (it, type, message, userMessage) => {
  const toUserId = it.opponentUid || targetUid.value;
  if (!toUserId) return;
  await addDoc(collection(db, "notifications"), {
    toUserId,
    fromUserId: auth.currentUser?.uid || "unknown",
    fromUserName: await getMyName(), // 一人称（あなた）が相手の画面に出ないよう users の名前を使う
    transactionId: it.id,
    type,
    message,
    eventName: it.eventName || null, // 件名を具体的にするため（イベント名）
    itemName: it.itemName || null,   // 取引名
    amount: it.amount || 0,
    userMessage: userMessage || null, // 送信者が添えた自由メッセージ（任意）
    isRead: false,
    createdAt: serverTimestamp()
  });
};

// 🌟 催促ボタン：すでに送っていれば再送の確認を挟む
const openRemind = () => {
  if (alreadyReminded.value) {
    showModal({
      type: 'warning', title: '催促の再送',
      message: `この相手にはすでに ${remindCount.value} 回催促を送っています。\nもう一度催促を送りますか？`,
      showCancel: true, confirmText: 'もう一度送る',
      onConfirm: () => { remindModalOpen.value = true; }
    });
  } else {
    remindModalOpen.value = true;
  }
};

// 🌟 催促（リマインド通知）を相手に送る ＋ 取引に催促回数を記録
const sendReminder = async ({ deadline, message } = {}) => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    for (const it of items.value) {
      await notifyOpponent(
        it,
        'payment_reminder',
        `支払いの催促が届きました（${deadline || '至急'}・¥${(it.amount || 0).toLocaleString()}）`,
        message
      );
      // 取引自体に催促回数・最終催促日時を記録（誰に何回催促したかの正データ）
      await updateDoc(doc(db, "transactions", it.id), {
        remindCount: increment(1),
        lastRemindedAt: serverTimestamp()
      });
      it.remindCount = (it.remindCount || 0) + 1; // 画面表示も即更新
      // グループチャットに経緯を流す（○回目の催促）
      const n = it.remindCount;
      await postPaymentEventByTx(it.id, { text: `${it.name || '相手'}さんへ${n}回目の催促を送りました`, kind: 'reminded', actorUid: auth.currentUser?.uid });
    }
    remindModalOpen.value = false;
    showModal({ type: 'success', title: '催促を送信しました', message: `相手に支払いの催促通知を送りました（通算 ${remindCount.value} 回）。` });
  } catch (error) {
    console.error(error);
    remindModalOpen.value = false;
    showModal({ type: 'error', title: 'エラー', message: '催促の送信に失敗しました。電波状況を確認してください。' });
  } finally {
    submitting.value = false;
  }
};

// 🌟 承認リクエストが届いている時に「承認して完了にする」を押した時の処理
// この画面で承認/拒否したら、対応する承認リクエストのお知らせも消す（残らないように）
const clearApprovalNotifs = async () => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    const txIds = new Set(items.value.map(i => i.id));
    const snap = await getDocs(query(collection(db, 'notifications'), where('toUserId', '==', myUid)));
    for (const d of snap.docs) {
      const n = d.data();
      if (n.type === 'approval_request' && txIds.has(n.transactionId)) {
        try { await updateDoc(doc(db, 'notifications', d.id), { isRead: true }); } catch (e) {}
      }
    }
  } catch (e) { console.error('承認リクエスト通知のクリアに失敗:', e); }
};

// 🌟 この画面から拒否したときも、双方向のまとめ精算で「その場で完了」にされた
//    逆方向の取引を未払いに戻す（お知らせの拒否ボタンと同じ結果にする）。
//    逆方向の記録が無い（＝単発や古い）お知らせは対象にならず、従来どおりの動き。
const revertBatchCounterparts = async () => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return 0;
  const txIds = items.value.map(i => i.id);
  let reverted = 0;
  try {
    const reqs = await findBatchApprovalRequests(myUid, txIds);
    for (const n of reqs) {
      const done = await revertCounterTransactions({
        myUid, otherUid: n.fromUserId, ids: n.counterTransactionIds, skipIds: txIds, text: COUNTER_REVERT_TEXT,
      });
      reverted += done.length;
      try { await updateDoc(doc(db, 'notifications', n.id), { isRead: true }); } catch (e) {}
    }
  } catch (e) { console.error('まとめ精算の差し戻しに失敗:', e); }
  return reverted;
};

const approvePayment = () => {
  showModal({
    type: 'warning', title: '支払いの承認',
    message: '相手からの支払いを確認しましたか？\n「承認」すると、この決済が完了します。',
    showCancel: true, confirmText: '承認する',
    withReason: true, reasonPlaceholder: '相手へのひとこと（任意・お礼など）',
    onConfirm: async (reason) => {
      if (submitting.value) return;
      submitting.value = true;
      try {
        await updateAllItems('completed');
        await clearApprovalNotifs(); // お知らせの承認リクエストを消す
        for (const it of items.value) {
          await logApprovalBoth({ myUid: auth.currentUser?.uid, myName: await getMyName(), otherUid: it.opponentUid, otherName: it.name, kind: 'payment', outcome: 'approved', itemName: it.itemName, amount: it.amount });
          await resolveThreadForTx(auth.currentUser?.uid, it.opponentUid, it.id); // 1対1チャットを消す
          // グループチャットに経緯を流す＋全員完了なら片付ける
          await postPaymentEventByTx(it.id, { text: `${it.name || '相手'}さんの支払いを承認し、精算しました`, kind: 'approved', actorUid: auth.currentUser?.uid });
          await resolvePaymentThreadByTx(it.id);
        }
        // 🌟 支払った側へ「支払いが完了しました」を届ける
        for (const it of items.value) {
          try { await notifyOpponent(it, 'payment_completed', '支払いが承認され、精算が完了しました。', reason); } catch (e) {}
        }
        currentStatus.value = 'completed';
        showModal({
          type: 'success', title: '精算完了', message: '支払いを承認し、精算が完了しました。',
          onConfirm: () => router.push('/')
        });
      } catch (error) {
        console.error(error);
        showModal({ type: 'error', title: 'エラー', message: '処理に失敗しました。電波状況を確認してもう一度お試しください。' });
      } finally {
        submitting.value = false;
      }
    }
  });
};

// 🌟 承認リクエストを「拒否」する処理（受け取る側）
const rejectPayment = () => {
  showModal({
    type: 'warning', title: '承認リクエストの拒否',
    message: 'この支払いを拒否しますか？\n相手に通知が届き、未払いに戻るため相手は再度リクエストできます。',
    showCancel: true, confirmText: '拒否する',
    onConfirm: async () => {
      if (submitting.value) return;
      submitting.value = true;
      try {
        await updateAllItems('unpaid'); // 未払いに戻す → 相手が再リクエスト可能
        await clearApprovalNotifs(); // お知らせの承認リクエストを消す
        const revertedCounter = await revertBatchCounterparts(); // 双方向のまとめ精算なら逆方向も戻す
        for (const it of items.value) {
          await logApprovalBoth({ myUid: auth.currentUser?.uid, myName: await getMyName(), otherUid: it.opponentUid, otherName: it.name, kind: 'payment', outcome: 'rejected', itemName: it.itemName, amount: it.amount });
          await postPaymentEventByTx(it.id, { text: `${it.name || '相手'}さんの支払いを差し戻しました（未払いに戻りました）`, kind: 'rejected', actorUid: auth.currentUser?.uid });
        }
        for (const it of items.value) {
          await notifyOpponent(it, 'approval_rejected', revertedCounter
            ? '承認リクエストが拒否されました。双方向の精算がすべて未払いに戻っています。もう一度お手続きできます。'
            : '承認リクエストが拒否されました。もう一度お支払い手続きをしてください。');
        }
        currentStatus.value = 'unpaid';
        showModal({
          type: 'info', title: '拒否しました',
          message: revertedCounter
            ? 'リクエストを拒否し、相手に通知を送りました。まとめ精算のため、相手が受け取った分も未払いに戻しました。'
            : 'リクエストを拒否し、相手に通知を送りました。',
          onConfirm: () => router.push('/')
        });
      } catch (error) {
        console.error(error);
        showModal({ type: 'error', title: 'エラー', message: '処理に失敗しました。電波状況を確認してもう一度お試しください。' });
      } finally {
        submitting.value = false;
      }
    }
  });
};

const confirmCash = () => {
  if (mode.value === 'remind') {
    showModal({
      type: 'warning', title: '現金の受け取り確認',
      message: 'お金を受け取りましたか？\n相手の支払い状況を「完了」に更新します。',
      showCancel: true, confirmText: '受け取った',
      withReason: true, reasonPlaceholder: '相手へのひとこと（任意・お礼など）',
      onConfirm: async (reason) => {
        if (submitting.value) return;
        submitting.value = true;
        try {
          await updateAllItems('completed');
          const myNm = await getMyName();
          // 🌟 支払った側へ「支払いが完了しました」を届ける
          for (const it of items.value) {
            try { await notifyOpponent(it, 'payment_completed', '受け取りが確認され、精算が完了しました。', reason); } catch (e) {}
            await resolveThreadForTx(auth.currentUser?.uid, it.opponentUid, it.id); // 1対1チャットを消す
            await postPaymentEventByTx(it.id, { text: `${myNm}さんが現金で受け取り、精算しました`, kind: 'completed', actorUid: auth.currentUser?.uid });
            await resolvePaymentThreadByTx(it.id);
          }
          currentStatus.value = 'completed';
          showModal({
            type: 'success', title: '精算完了', message: '受け取りを記録しました。',
            onConfirm: () => router.push('/')
          });
        } catch (error) {
          console.error(error);
          showModal({ type: 'error', title: 'エラー', message: '処理に失敗しました。電波状況を確認してもう一度お試しください。' });
        } finally {
          submitting.value = false;
        }
      }
    });
  } else {
    showModal({
      type: 'warning', title: '現金の支払い確認',
      message: 'お金を支払いましたか？\n相手に「受け取り完了の承認リクエスト」を送ります。',
      showCancel: true, confirmText: '支払った',
      withReason: true, reasonPlaceholder: 'ひとこと（任意・PayPayで送った等）',
      onConfirm: async (reason) => {
        if (submitting.value) return;
        submitting.value = true;
        try {
          await updateAllItems('awaiting_approval');
          const myNm = await getMyName();
          for (const it of items.value) {
            await notifyOpponent(it, 'approval_request', '支払いの承認リクエストが届きました。', reason);
            await postPaymentEventByTx(it.id, { text: `${myNm}さんが支払いました（相手の承認待ち）`, kind: 'paid', actorUid: auth.currentUser?.uid });
          }
          currentStatus.value = 'awaiting_approval'; // 画面のボタンを「承認待ち」に切り替える
          showModal({
            type: 'success', title: '送信しました', message: '承認リクエストを送信しました。相手の確認を待ちます。',
            onConfirm: () => router.push('/')
          });
        } catch (error) {
          console.error(error);
          showModal({ type: 'error', title: 'エラー', message: '処理に失敗しました。電波状況を確認してもう一度お試しください。' });
        } finally {
          submitting.value = false;
        }
      }
    });
  }
};
</script>

<style scoped>
/* 基本スタイル */
.payment-detail-container { width: 100%; background-color: var(--c-bg); display: flex; flex-direction: column; box-sizing: border-box; overflow-x: hidden; }
.detail-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); position: sticky; top: 60px; z-index: 100; border-radius: 0 0 24px 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 15px; }
.back-btn { background: none; border: none; font-size: 32px; color: var(--c-ink); cursor: pointer; padding: 0; display: flex; align-items: center; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.title { font-size: 18px; font-weight: 900; margin: 0; color: var(--c-ink); flex: 1; text-align: center; }
.spacer { width: 32px; }
.content { padding: 8px var(--pad) 28px; width: 100%; box-sizing: border-box; }
.state-msg { text-align: center; padding: 48px 16px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.summary-card { padding: 22px; border-radius: var(--r-lg); color: white; text-align: center; margin-bottom: 18px; box-shadow: var(--shadow-card); }
.blue-mode { background: var(--c-receive); }
.orange-mode { background: var(--c-pay); }
.total-amount { font-size: 36px; font-weight: bold; margin: 5px 0; }
.remind-status { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,0.22); font-size: 12px; font-weight: 800; }
.section-sub { font-size: 16px; font-weight: bold; color: var(--c-text); margin: 20px 0 10px; text-align: left; }
.footer-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 30px; }
.method-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; }
.method-btn:active:not(:disabled) { transform: scale(0.98); }

/* 🌟 ボタンの出し分け用スタイル追加 */
.cash { background-color: var(--c-brand); color: white; }
.approve { background-color: var(--c-brand); color: white; box-shadow: 0 4px 12px rgba(5,150,105,0.3); }
.reject { background-color: #fff; border: 1.5px solid var(--c-danger); color: var(--c-danger); }
.reject:active:not(:disabled) { background-color: var(--c-danger-weak); }
.remind-btn { background-color: var(--c-receive); color: #fff; margin-top: 10px; }
.remind-btn:active:not(:disabled) { transform: scale(0.98); }
.disabled-btn { background-color: var(--c-line-strong); color: var(--c-text-strong); cursor: not-allowed; }
.method-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 承認待ちバナー */
.await-banner {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--c-pay-weak); border: 1px solid #fcd9a5;
  border-radius: var(--r-md); padding: 14px 16px; margin-bottom: 6px;
  color: var(--c-pay-strong);
}
.await-banner--action { background: var(--c-brand-weak); border-color: #a7e3c8; color: var(--c-brand-strong); }
.await-banner__icon { flex-shrink: 0; margin-top: 1px; }
.await-banner__body { min-width: 0; }
.await-banner__title { font-size: 14px; font-weight: var(--fw-bold); margin: 0 0 3px; }
.await-banner__text { font-size: 12px; line-height: 1.5; opacity: 0.92; margin: 0; }

.completed-section { margin-top: 30px; }
.completed-card { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 25px; text-align: center; color: #166534; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
.completed-icon { font-size: 32px; display: block; margin-bottom: 10px; }
.completed-title { font-size: 16px; font-weight: bold; margin: 0 0 5px 0; }
.completed-date { font-size: 12px; opacity: 0.8; margin: 0; }

.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--c-overlay); display: flex; align-items: flex-end; z-index: 3000; }
.overlay-content { background: white; width: 100%; padding: 30px; border-radius: 30px 30px 0 0; position: relative; }
.close-overlay { position: absolute; top: 15px; right: 15px; font-size: 24px; border: none; background: none; color: var(--c-line-strong); }
.main-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; background: var(--c-text); color: white; font-weight: bold; margin-top: 20px; }
</style>