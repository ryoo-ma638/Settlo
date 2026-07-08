<template>
  <div class="notification-wrapper" :class="{ 'static-mode': isStatic }">
    <button v-if="!isStatic" class="icon-btn" @click="showModal = true" aria-label="お知らせ">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      <span v-if="totalNotifs > 0" class="notification-dot"></span>
    </button>

    <Teleport to="body" v-if="!isStatic">
      <transition name="fade">
        <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
          <div class="modal-window">
            <h2 class="modal-title">お知らせ</h2>
            <div class="notification-list">

              <div v-for="req in paymentReqs" :key="req.id" class="notif-item" :class="notifClass(req)">
                <div class="notif-body">
                  <p><strong>{{ req.fromUserName }}</strong>{{ notifText(req) }}</p>
                  <p v-if="req.message" class="notif-sub">{{ req.message }}</p>
                  <p v-if="req.userMessage" class="notif-msg">{{ req.userMessage }}</p>
                  <p v-if="req.changes" class="notif-changes">{{ req.changes }}</p>
                  <div class="notif-actions">
                    <template v-if="req.type === 'event_invite'">
                      <button class="mini-btn" @click="acceptInvite(req)">参加する</button>
                      <button class="mini-btn mini-btn--ghost" @click="rejectInvite(req)">心当たりがない</button>
                    </template>
                    <template v-else-if="req.type === 'settlement_restore_request'">
                      <button class="mini-btn" @click="approveRestore(req)">承認する</button>
                      <button class="mini-btn mini-btn--ghost" @click="rejectRestore(req)">拒否する</button>
                    </template>
                    <template v-else-if="req.type === 'approval_request' || (!req.type && req.transactionId)">
                      <button class="mini-btn" @click="approveTx(req)">承認する</button>
                      <button class="mini-btn mini-btn--ghost" @click="rejectTx(req)">拒否する</button>
                      <button class="mini-btn mini-btn--ghost" @click="goToPaymentDetail(req)">詳細</button>
                    </template>
                    <template v-else-if="req.type === 'payment_completed' || req.type === 'profile_updated'">
                      <button class="mini-btn mini-btn--ghost" @click="dismissNotif(req)">確認</button>
                    </template>
                    <template v-else-if="isJudgeType(req.type)">
                      <button class="mini-btn" @click="judgeOk(req)">正しい</button>
                      <button class="mini-btn mini-btn--ghost" @click="judgeNg(req)">正しくない</button>
                    </template>
                    <template v-else>
                      <button class="mini-btn" @click="goToPaymentDetail(req)">{{ notifAction(req) }}</button>
                      <button class="mini-btn mini-btn--ghost" @click="dismissNotif(req)">確認</button>
                    </template>
                  </div>
                </div>
              </div>

              <div v-for="req in friendReqs" :key="req.id" class="notif-item notif-item--friend">
                <div class="notif-body">
                  <template v-if="req.status === 'pending'">
                    <p>{{ req.formName }}さんから友達申請が届いています</p>
                    <p v-if="req.userMessage" class="notif-msg">{{ req.userMessage }}</p>
                    <div class="notif-actions">
                      <button class="mini-btn" @click="acceptRequest(req)">承認する</button>
                      <button class="mini-btn mini-btn--ghost" @click="rejectFriendRequest(req)">拒否する</button>
                    </div>
                  </template>
                  <template v-else-if="req.status === 'accepted'">
                    <p>{{ req.formName }}さんとフレンドになりました</p>
                    <button class="mini-btn mini-btn--ghost" @click="deleteNotification(req.id)">確認</button>
                  </template>
                </div>
              </div>

              <div v-if="totalNotifs === 0" class="empty-msg">新しいお知らせはありません</div>
            </div>
            <button class="close-modal-btn" @click="showModal = false">閉じる</button>
          </div>
        </div>
      </transition>
    </Teleport>

    <div v-else class="static-notification-panel">
      <h2 class="sidebar-title">お知らせ</h2>
      <div class="notification-list">
        <div v-for="req in paymentReqs" :key="req.id" class="notif-item" :class="notifClass(req)">
          <div class="notif-body">
            <p><strong>{{ req.fromUserName }}</strong>{{ notifText(req) }}</p>
            <p v-if="req.message" class="notif-sub">{{ req.message }}</p>
            <p v-if="req.userMessage" class="notif-msg">{{ req.userMessage }}</p>
            <p v-if="req.changes" class="notif-changes">{{ req.changes }}</p>
            <div class="notif-actions">
              <template v-if="req.type === 'event_invite'">
                <button class="mini-btn" @click="acceptInvite(req)">参加する</button>
                <button class="mini-btn mini-btn--ghost" @click="rejectInvite(req)">心当たりがない</button>
              </template>
              <template v-else-if="req.type === 'settlement_restore_request'">
                <button class="mini-btn" @click="approveRestore(req)">承認する</button>
                <button class="mini-btn mini-btn--ghost" @click="rejectRestore(req)">拒否する</button>
              </template>
              <template v-else-if="req.type === 'approval_request' || (!req.type && req.transactionId)">
                <button class="mini-btn" @click="approveTx(req)">承認する</button>
                <button class="mini-btn mini-btn--ghost" @click="rejectTx(req)">拒否する</button>
                <button class="mini-btn mini-btn--ghost" @click="goToPaymentDetail(req)">詳細</button>
              </template>
              <template v-else-if="req.type === 'payment_completed' || req.type === 'profile_updated'">
                <button class="mini-btn mini-btn--ghost" @click="dismissNotif(req)">確認</button>
              </template>
              <template v-else-if="isJudgeType(req.type)">
                <button class="mini-btn" @click="judgeOk(req)">正しい</button>
                <button class="mini-btn mini-btn--ghost" @click="judgeNg(req)">正しくない</button>
              </template>
              <template v-else>
                <button class="mini-btn" @click="goToPaymentDetail(req)">{{ notifAction(req) }}</button>
                <button class="mini-btn mini-btn--ghost" @click="dismissNotif(req)">確認</button>
              </template>
            </div>
          </div>
        </div>
        <div v-for="req in friendReqs" :key="req.id" class="notif-item notif-item--friend">
          <div class="notif-body">
            <template v-if="req.status === 'pending'">
              <p>{{ req.formName }}さんから友達申請が届いています</p>
              <p v-if="req.userMessage" class="notif-msg">{{ req.userMessage }}</p>
              <div class="notif-actions">
                <button class="mini-btn" @click="acceptRequest(req)">承認する</button>
                <button class="mini-btn mini-btn--ghost" @click="rejectFriendRequest(req)">拒否する</button>
              </div>
            </template>
            <template v-else-if="req.status === 'accepted'">
              <p>{{ req.formName }}さんとフレンドになりました</p>
              <button class="mini-btn mini-btn--ghost" @click="deleteNotification(req.id)">確認</button>
            </template>
          </div>
        </div>
        <div v-if="totalNotifs === 0" class="empty-msg">新しいお知らせはありません</div>
      </div>
    </div>
  </div>

  <BaseModal
    :show="modalState.show"
    :type="modalState.type"
    :title="modalState.title"
    :message="modalState.message"
    @confirm="modalState.show = false"
    @close="modalState.show = false"
  />

  <BaseModal
    :show="confirmState.show"
    type="warning"
    :title="confirmState.title"
    :message="confirmState.message"
    :showCancel="true"
    confirmText="はい"
    cancelText="いいえ"
    @confirm="doConfirm"
    @cancel="confirmState.show = false"
    @close="confirmState.show = false"
  />
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import BaseModal from './BaseModal.vue';
import { db, auth } from '@/firebase';
import {
  collection, query, where, onSnapshot, getDocs,
  doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, increment
} from 'firebase/firestore';

const router = useRouter();
const friendReqs = ref([]);
const paymentReqs = ref([]);

// 通知タイプごとの表示文言・ボタン
const notifText = (req) => {
  if (req.type === 'approval_rejected') return 'さんがあなたの承認リクエストを拒否しました';
  if (req.type === 'payment_reminder') return 'さんから支払いの催促が届いています';
  if (req.type === 'payment_edited') return `さんが「${req.itemName || '支払い'}」（¥${(req.amount || 0).toLocaleString()}）を編集しました`;
  if (req.type === 'payment_deleted') return `さんが「${req.itemName || '支払い'}」（¥${(req.amount || 0).toLocaleString()}）を削除しました。これは正しいですか？`;
  if (req.type === 'event_edited') return `さんがイベント「${req.eventName || ''}」を編集しました`;
  if (req.type === 'event_invite') return `さんがイベント「${req.eventName || ''}」に招待しています。心当たりはありますか？`;
  if (req.type === 'invite_rejected') return `さんがイベント「${req.eventName || ''}」への招待を拒否しました。内容が正しいか再確認してください`;
  if (req.type === 'event_joined') return `さんがイベント「${req.eventName || ''}」に参加しました`;
  if (req.type === 'event_restored') return `さんがイベント「${req.eventName || ''}」に戻ってきました（ゴミ箱から復元）。これは正しいですか？`;
  if (req.type === 'settlement_restore_request') return `さんが決済「${req.itemName || ''}」（¥${(req.amount || 0).toLocaleString()}）を未精算に戻したいそうです。承認しますか？`;
  if (req.type === 'settlement_restore_approved') return `さんが「${req.itemName || ''}」を未精算に戻すことを承認しました`;
  if (req.type === 'settlement_restore_rejected') return `さんが「${req.itemName || ''}」を未精算に戻すことを拒否しました。これは正しいですか？（正しくない＝もう一度依頼します）`;
  if (req.type === 'payment_completed') return 'さんとの支払いが完了しました！';
  if (req.type === 'profile_updated') return 'さんがプロフィールを更新しました';
  if (req.type === 'restore_check') return `さんが「${req.itemName || ''}」（¥${(req.amount || 0).toLocaleString()}）をゴミ箱から元に戻しました。こちらで正しいですか？`;
  if (req.type === 'restore_reverted') return `さんが「正しくない」を選び、「${req.itemName || ''}」をゴミ箱に戻しました。これは正しいですか？（正しくない＝もう一度元に戻します）`;
  if (req.type === 'payment_delete_rejected') return `さんは「${req.itemName || ''}」の削除は正しくないと考えています。これは正しいですか？（正しい＝ゴミ箱から元に戻します／正しくない＝削除を続けます）`;
  if (req.type === 'event_left_check') return `さんがイベント「${req.eventName || ''}」から抜けました（自分の画面から削除）。これは正しいですか？`;
  if (req.type === 'event_left_rejected') return `さんは、あなたがイベント「${req.eventName || ''}」から抜けたのは正しくないと考えています。これは正しいですか？（正しい＝イベントに戻ります／正しくない＝削除を続けます）`;
  if (req.type === 'event_restore_rejected') return `さんが「正しくない」を選び、イベント「${req.eventName || ''}」をゴミ箱に戻しました。これは正しいですか？（正しくない＝もう一度復帰します）`;
  return 'さんから支払いの承認リクエストが届いています';
};
const notifAction = (req) => {
  if (req.type === 'approval_rejected') return 'もう一度支払う';
  if (req.type === 'payment_reminder') return '支払う';
  if (['payment_edited', 'event_edited', 'invite_rejected', 'event_joined', 'settlement_restore_approved', 'settlement_restore_rejected', 'event_left_rejected', 'event_restore_rejected'].includes(req.type)) return 'イベントを見る';
  if (req.type === 'payment_deleted' || req.type === 'payment_completed') return '確認';
  return '詳細を確認する';
};
const notifClass = (req) => {
  if (['approval_rejected', 'invite_rejected', 'settlement_restore_rejected', 'restore_reverted', 'event_left_rejected', 'event_restore_rejected'].includes(req.type)) return 'notif-item--reject';
  if (['payment_edited', 'payment_deleted', 'event_edited', 'event_joined', 'event_restored', 'settlement_restore_approved', 'payment_completed', 'profile_updated'].includes(req.type)) return 'notif-item--info';
  return 'notif-item--pay';
};

const totalNotifs = computed(() => friendReqs.value.length + paymentReqs.value.length);

onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      friendReqs.value = [];
      paymentReqs.value = [];
      return;
    }

    const qFriend = query(
      collection(db, "friendRequests"),
      where("toId", "==", user.uid),
      where("status", "in", ["pending", "accepted"])
    );
    onSnapshot(qFriend, (snapshot) => {
      friendReqs.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });

    const qPayment = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.uid),
      where("isRead", "==", false)
    );
    onSnapshot(qPayment, (snapshot) => {
      paymentReqs.value = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // 新しい順
    });
  });
});

const goToPaymentDetail = async (req) => {
  try {
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    showModal.value = false;
    // 編集/削除通知は該当イベントへ（対象の取引はもう無い/変わっているため）
    if (req.type === 'payment_edited' || req.type === 'payment_deleted') {
      if (req.eventId) router.push(`/event/${req.eventId}`);
      return;
    }
    // 編集/削除/イベント編集/招待拒否/参加/復元/決済戻し結果は該当イベントへ（対象の取引はもう無い/変わっているため）
    if (['payment_edited', 'payment_deleted', 'event_edited', 'invite_rejected', 'event_joined', 'event_restored', 'settlement_restore_approved', 'settlement_restore_rejected', 'restore_reverted', 'event_left_rejected', 'event_restore_rejected'].includes(req.type)) {
      if (req.eventId) router.push(`/event/${req.eventId}`);
      return;
    }
    // 支払い完了のお知らせは既読にするだけ（取引はもう完了している）
    if (req.type === 'payment_completed') return;
    // 承認リクエストだけ受け取る側（waiting-）。拒否・催促は支払う側（unpaid-）へ。
    const prefix = req.type === 'approval_request' || !req.type ? 'waiting' : 'unpaid';
    router.push(`/payment-detail/${prefix}-${req.transactionId}`);
  } catch (error) {
    console.error("詳細画面への移動に失敗:", error);
  }
};

const deleteNotification = async (notifId) => {
  try { await deleteDoc(doc(db, "friendRequests", notifId)); }
  catch (error) { console.error("通知の削除に失敗しました:", error); }
};

// 友達申請を拒否＝申請を削除（承認/拒否を選ぶまでお知らせに残す）
const rejectFriendRequest = (req) => {
  askConfirm('友達申請を拒否しますか？', `${req.formName || '相手'}さんからの友達申請を削除します。`, async () => {
    try { await deleteDoc(doc(db, "friendRequests", req.id)); }
    catch (e) { console.error("友達申請の拒否に失敗:", e); }
  });
};

// 支払い系の通知を「確認済み（既読）」にして一覧から消す
const dismissNotif = async (req) => {
  try { await updateDoc(doc(db, "notifications", req.id), { isRead: true }); }
  catch (error) { console.error("通知の既読化に失敗しました:", error); }
};

const modalState = reactive({ show: false, type: 'success', title: '', message: '' });
// 結果をユーザーに必ず見せる（成功/失敗を黙らせない）
const notice = (type, title, message) => { Object.assign(modalState, { type, title, message, show: true }); };

// 招待の拒否時の二段階確認ダイアログ
const confirmState = reactive({ show: false, title: '', message: '', onConfirm: null });
const askConfirm = (title, message, onConfirm) => { Object.assign(confirmState, { title, message, onConfirm, show: true }); };
const doConfirm = () => { const cb = confirmState.onConfirm; confirmState.show = false; if (cb) cb(); };

// 🌟 招待を承認＝自分をイベント参加者に追加＋既存メンバーへ「参加しました」通知
const acceptInvite = async (req) => {
  try {
    const myUid = auth.currentUser?.uid;
    if (req.eventId && myUid) {
      // 追加前の参加者を取得（この人たちに参加をお知らせする）
      let existing = [];
      let evName = req.eventName || '';
      try {
        const ev = await getDoc(doc(db, "events", req.eventId));
        if (ev.exists()) { existing = ev.data().participants || []; evName = ev.data().name || evName; }
      } catch (e) {}
      await updateDoc(doc(db, "events", req.eventId), { participants: arrayUnion(myUid) });
      // 自分の表示名
      let myName = auth.currentUser?.displayName || 'メンバー';
      try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) myName = md.data().name; } catch (e) {}
      // 既存メンバーへ通知
      for (const uid of existing) {
        if (uid === myUid) continue;
        try {
          await addDoc(collection(db, "notifications"), {
            toUserId: uid, type: 'event_joined',
            eventId: req.eventId, eventName: evName,
            fromUserId: myUid, fromUserName: myName,
            isRead: false, createdAt: serverTimestamp(),
          });
        } catch (e) {}
      }
    }
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    showModal.value = false;
    if (req.eventId) router.push(`/event/${req.eventId}`);
  } catch (e) { console.error("招待承認エラー:", e); }
};

// 🌟 招待を拒否＝二段階確認 → 招待した人へ「拒否された」通知
const rejectInvite = (req) => {
  askConfirm('本当に心当たりがないですか？', `イベント「${req.eventName || ''}」への招待を拒否します。招待した人に通知されます。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      let myName = auth.currentUser?.displayName || 'メンバー';
      try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) myName = md.data().name; } catch (e) {}
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId,
        type: 'invite_rejected',
        eventId: req.eventId,
        eventName: req.eventName || '',
        fromUserId: myUid || 'unknown',
        fromUserName: myName,
        isRead: false,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("招待拒否エラー:", e); }
  });
};

// 自分の表示名を取得（通知の差出人名に使う）
const getMyName = async () => {
  const myUid = auth.currentUser?.uid;
  let name = auth.currentUser?.displayName || 'メンバー';
  try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) name = md.data().name; } catch (e) {}
  return name;
};

// 🌟 支払いの承認リクエストを「承認」＝取引を完了にして相手へ完了通知
const approveTx = async (req) => {
  try {
    const myUid = auth.currentUser?.uid;
    if (!myUid || !req.transactionId) return;
    const t = await getDoc(doc(db, "transactions", req.transactionId));
    if (!t.exists() || t.data().paidToId !== myUid) { // 受け取る側だけが承認できる
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      return;
    }
    await updateDoc(doc(db, "transactions", req.transactionId), { status: 'completed' });
    await addDoc(collection(db, "notifications"), {
      toUserId: req.fromUserId, type: 'payment_completed',
      message: '支払いが承認され、精算が完了しました。',
      transactionId: req.transactionId,
      fromUserId: myUid, fromUserName: await getMyName(),
      isRead: false, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
  } catch (e) { console.error("支払い承認エラー:", e); }
};

// 🌟 支払いの承認リクエストを「拒否」＝未払いに戻して相手へ通知（相手は再リクエスト可）
const rejectTx = (req) => {
  askConfirm('支払いを拒否しますか？', 'この支払いは未払いに戻り、相手に通知が届きます（相手は再度お支払い手続きができます）。', async () => {
    try {
      const myUid = auth.currentUser?.uid;
      if (!myUid || !req.transactionId) return;
      await updateDoc(doc(db, "transactions", req.transactionId), { status: 'unpaid' });
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'approval_rejected',
        message: '承認リクエストが拒否されました。もう一度お支払い手続きをしてください。',
        transactionId: req.transactionId,
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("支払い拒否エラー:", e); }
  });
};

// 🌟 「決済を未精算に戻す」リクエストを承認＝自分が当事者の取引を未精算へ戻す
const approveRestore = async (req) => {
  try {
    const myUid = auth.currentUser?.uid;
    for (const tid of (req.transactionIds || [])) {
      try {
        const t = await getDoc(doc(db, "transactions", tid));
        if (t.exists()) {
          const d = t.data();
          if (d.paidById === myUid || d.paidToId === myUid) {
            await updateDoc(doc(db, "transactions", tid), { status: 'unpaid' });
          }
        }
      } catch (e) {}
    }
    let myName = auth.currentUser?.displayName || 'メンバー';
    try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) myName = md.data().name; } catch (e) {}
    await addDoc(collection(db, "notifications"), {
      toUserId: req.fromUserId, type: 'settlement_restore_approved',
      eventId: req.eventId || null, eventName: req.eventName || '', itemName: req.itemName || '',
      fromUserId: myUid, fromUserName: myName, isRead: false, createdAt: serverTimestamp(),
    });
    // 🌟 共有ゴミ箱の控えを確定（復元完了なので消す）
    if (req.trashId) { try { await deleteDoc(doc(db, "trash", req.trashId)); } catch (e) {} }
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
  } catch (e) { console.error("復元承認エラー:", e); }
};

// 🌟 「決済を未精算に戻す」リクエストを拒否＝完了のまま・依頼者へ通知
const rejectRestore = (req) => {
  askConfirm('未精算に戻すのを拒否しますか？', `「${req.itemName || ''}」は完了のままになります。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      let myName = auth.currentUser?.displayName || 'メンバー';
      try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) myName = md.data().name; } catch (e) {}
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'settlement_restore_rejected',
        trashId: req.trashId || null, transactionIds: req.transactionIds || [],
        historyId: req.historyId || null, amount: req.amount || 0,
        eventId: req.eventId || null, eventName: req.eventName || '', itemName: req.itemName || '',
        fromUserId: myUid, fromUserName: myName, isRead: false, createdAt: serverTimestamp(),
      });
      // 🌟 共有ゴミ箱の控えを「保留」からゴミ箱に戻す（完了のまま）
      if (req.trashId) { try { await updateDoc(doc(db, "trash", req.trashId), { status: 'trashed' }); } catch (e) {} }
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("復元拒否エラー:", e); }
  });
};

// 🌟 復元の確認「正しい」＝復元を確定（ゴミ箱の控えを消す）
const confirmRestoreOk = async (req) => {
  try {
    if (req.trashId) { try { await deleteDoc(doc(db, "trash", req.trashId)); } catch (e) {} }
    await updateDoc(doc(db, "notifications", req.id), { isRead: true });
  } catch (e) { console.error("復元確認エラー:", e); }
};

// 🌟 復元の確認「正しくない」＝復元された取引・履歴を消してゴミ箱に差し戻し、復元した人へ通知
const confirmRestoreNg = (req) => {
  askConfirm('「正しくない」を選びますか？', `「${req.itemName || ''}」を削除リスト（ゴミ箱）に戻します。相手に通知が届きます。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      if (!req.trashId) { await updateDoc(doc(db, "notifications", req.id), { isRead: true }); return; }
      const t = await getDoc(doc(db, "trash", req.trashId));
      if (t.exists()) {
        const d = t.data();
        // 復元で作り直された取引・履歴を削除して元のゴミ箱状態に戻す
        for (const tid of (d.restoredTransactionIds || [])) {
          try { await deleteDoc(doc(db, "transactions", tid)); } catch (e) {}
        }
        if (d.eventId && d.restoredHistoryId) {
          try { await deleteDoc(doc(db, "events", d.eventId, "history", d.restoredHistoryId)); } catch (e) {}
        }
        if (d.eventId) {
          try { await updateDoc(doc(db, "events", d.eventId), { totalAmount: increment(-(Number(d.amount) || 0)) }); } catch (e) {}
        }
        await updateDoc(doc(db, "trash", req.trashId), {
          status: 'trashed', restoredHistoryId: null, restoredTransactionIds: [], restoredBy: null,
        });
        // 復元した人へ「差し戻しました」通知
        await addDoc(collection(db, "notifications"), {
          toUserId: d.restoredBy || req.fromUserId, type: 'restore_reverted',
          trashId: req.trashId,
          eventId: d.eventId || null, eventName: d.eventName || '',
          itemName: d.itemName || '', amount: Number(d.amount) || 0,
          fromUserId: myUid, fromUserName: await getMyName(),
          isRead: false, createdAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("復元差し戻しエラー:", e); }
  });
};

// 🌟 「〇〇さんが抜けました」に「正しくない」＝削除した人へ再確認を促す通知
const rejectEventLeft = (req) => {
  askConfirm('「正しくない」を選びますか？', `${req.fromUserName || '相手'}さんに「削除が正しいか再確認してください」と通知します（ゴミ箱から戻せます）。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'event_left_rejected',
        trashId: req.trashId || null,
        eventId: req.eventId || null, eventName: req.eventName || '',
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("退出の差し戻し通知エラー:", e); }
  });
};

// 🌟 「〇〇さんが復元しました（戻ってきました）」に「正しくない」＝イベントを実際にゴミ箱へ戻す
const rejectEventRestore = (req) => {
  askConfirm('「正しくない」を選びますか？', `イベント「${req.eventName || ''}」を${req.fromUserName || '相手'}さんの画面から再び非表示にし、ゴミ箱に戻します。相手に通知が届きます。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      // 復元した人の画面から再び非表示に（本人のゴミ箱側は自己修復で trashed に戻る）
      if (req.eventId && req.fromUserId) {
        try { await updateDoc(doc(db, "events", req.eventId), { hiddenBy: arrayUnion(req.fromUserId) }); } catch (e) {}
      }
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'event_restore_rejected',
        eventId: req.eventId || null, eventName: req.eventName || '',
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("復帰拒否の通知エラー:", e); }
  });
};

// ==========================================
// 🌟 「正しい／正しくない」判断ループの共通処理
//    差し戻された側も再び判断でき、決着がつくまで交互に確認が続く
// ==========================================

// 通知から対象のゴミ箱の控えを特定する（古い通知に trashId が無くても、内容から探し出す）
const resolveTrashDoc = async (req) => {
  if (req.trashId) {
    try {
      const t = await getDoc(doc(db, "trash", req.trashId));
      if (t.exists()) return { id: t.id, data: t.data() };
    } catch (e) {}
  }
  // フォールバック：自分が当事者の控えから、イベント・品名・金額が一致するものを探す
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDocs(query(collection(db, 'trash'), where('participants', 'array-contains', uid)));
    const cands = snap.docs
      .map(d => ({ id: d.id, data: d.data() }))
      .filter(x => (!req.eventId || x.data.eventId === req.eventId)
        && (!req.itemName || x.data.itemName === req.itemName)
        && (req.amount == null || Number(x.data.amount) === Number(req.amount)))
      .sort((a, b) => (b.data.trashedAt?.seconds || 0) - (a.data.trashedAt?.seconds || 0));
    return cands[0] || null;
  } catch (e) { return null; }
};

// 共有ゴミ箱の控えから支払いを復元し、相手へ「正しいですか？」を送る
const restorePaymentFromTrash = async (req) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const found = await resolveTrashDoc(req);
  if (!found) return false;
  const trashId = found.id;
  const d = found.data;
  if (d.status === 'restored') return true; // すでに復元済み
  const newTxIds = [];
  for (const tx of (d.transactionSnapshots || [])) {
    const ref = await addDoc(collection(db, 'transactions'), { ...tx, createdAt: serverTimestamp() });
    newTxIds.push(ref.id);
  }
  const hs = d.historySnapshot || {};
  const histRef = await addDoc(collection(db, 'events', d.eventId, 'history'), {
    ...hs, transactionIds: newTxIds, status: 'unpaid', timestamp: serverTimestamp(),
  });
  await updateDoc(doc(db, 'events', d.eventId), { totalAmount: increment(Number(d.amount) || 0) });
  await updateDoc(doc(db, 'trash', trashId), {
    status: 'restored', restoredBy: uid,
    restoredHistoryId: histRef.id, restoredTransactionIds: newTxIds, restoredAt: serverTimestamp(),
  });
  const name = await getMyName();
  for (const pUid of (d.participants || [])) {
    if (pUid === uid) continue;
    await addDoc(collection(db, 'notifications'), {
      toUserId: pUid, type: 'restore_check', trashId,
      eventId: d.eventId || null, eventName: d.eventName || '',
      itemName: d.itemName || '支払い', amount: Number(d.amount) || 0,
      fromUserId: uid, fromUserName: name, isRead: false, createdAt: serverTimestamp(),
    });
  }
  return true;
};

// イベントに戻る（hiddenBy解除＋自分の控えを確認待ちに＋参加者へ「正しいですか？」）
const restoreEventAgain = async (req) => {
  const uid = auth.currentUser?.uid;
  if (!uid || !req.eventId) return;
  await updateDoc(doc(db, 'events', req.eventId), { hiddenBy: arrayRemove(uid) });
  try {
    if (req.trashId) {
      await updateDoc(doc(db, 'users', uid, 'trash', req.trashId), { status: 'restored', restoredBy: uid, restoredAt: serverTimestamp() });
    } else {
      const snap = await getDocs(query(collection(db, 'users', uid, 'trash'), where('eventId', '==', req.eventId)));
      for (const dd of snap.docs) { await updateDoc(dd.ref, { status: 'restored', restoredBy: uid, restoredAt: serverTimestamp() }); }
    }
  } catch (e) {}
  const name = await getMyName();
  try {
    const ev = await getDoc(doc(db, 'events', req.eventId));
    const parts = ev.exists() ? (ev.data().participants || []) : [];
    for (const pUid of parts) {
      if (pUid === uid) continue;
      await addDoc(collection(db, 'notifications'), {
        toUserId: pUid, type: 'event_restored',
        eventId: req.eventId, eventName: req.eventName || '',
        fromUserId: uid, fromUserName: name, isRead: false, createdAt: serverTimestamp(),
      });
    }
  } catch (e) {}
};

// --- 支払い削除の判断ループ ---
// 「削除は正しくない」と返す（削除された側）
const rejectPaymentDelete = (req) => {
  askConfirm('「正しくない」を選びますか？', `${req.fromUserName || '相手'}さんに「この削除は正しくない」と伝えます。相手が認めるとゴミ箱から元に戻ります。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'payment_delete_rejected',
        trashId: req.trashId || null,
        eventId: req.eventId || null, eventName: req.eventName || '',
        itemName: req.itemName || '', amount: Number(req.amount) || 0,
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', '相手に伝えました', `${req.fromUserName || '相手'}さんに「削除は正しくない」と伝えました。相手の判断をお待ちください。`);
    } catch (e) {
      console.error("削除への異議通知エラー:", e);
      notice('error', 'エラー', '通知の送信に失敗しました。もう一度お試しください。');
    }
  });
};

// 相手の「削除は正しくない」を認める＝ゴミ箱から元に戻す（削除した側）
const acceptDeleteRejection = (req) => {
  askConfirm('削除をやめて元に戻しますか？', `「${req.itemName || ''}」をゴミ箱から元に戻し、相手に「正しいですか？」の確認を送ります。`, async () => {
    try {
      const ok = await restorePaymentFromTrash(req);
      if (!ok) {
        notice('error', '元に戻せませんでした', 'ゴミ箱に控えが見つかりませんでした（自動削除された可能性があります）。ゴミ箱を確認してください。');
        return; // 通知は残す
      }
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', '元に戻しました', 'ゴミ箱から復元し、相手に「正しいですか？」の確認を送りました。');
    } catch (e) {
      console.error("削除取り消しエラー:", e);
      notice('error', 'エラー', '元に戻す処理に失敗しました。電波状況を確認してもう一度お試しください。');
    }
  });
};

// 「いや、削除で正しい」と再主張（削除した側）→ 相手にまた判断が飛ぶ
const reassertDelete = (req) => {
  askConfirm('削除を続けますか？', `${req.fromUserName || '相手'}さんに、もう一度「削除は正しい」と確認を送ります。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'payment_deleted',
        trashId: req.trashId || null,
        eventId: req.eventId || null, eventName: req.eventName || '',
        itemName: req.itemName || '', amount: Number(req.amount) || 0,
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("削除の再主張エラー:", e); }
  });
};

// 差し戻し（restore_reverted）に「正しくない」＝もう一度元に戻す
const reRestorePayment = (req) => {
  askConfirm('もう一度元に戻しますか？', `「${req.itemName || ''}」を再び復元し、相手に「正しいですか？」の確認を送ります。`, async () => {
    try {
      const ok = await restorePaymentFromTrash(req);
      if (!ok) {
        notice('error', '復元できませんでした', 'ゴミ箱に控えが見つかりませんでした。ゴミ箱を確認してください。');
        return; // 通知は残す
      }
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', '元に戻しました', '再び復元し、相手に「正しいですか？」の確認を送りました。');
    } catch (e) {
      console.error("再復元エラー:", e);
      notice('error', 'エラー', '復元に失敗しました。電波状況を確認してもう一度お試しください。');
    }
  });
};

// --- イベントの判断ループ ---
// 相手の「退出は正しくない」を認める＝イベントに戻る（削除した側）
const acceptLeftRejection = (req) => {
  askConfirm('イベントに戻りますか？', `イベント「${req.eventName || ''}」をゴミ箱から戻し、参加者に「正しいですか？」の確認を送ります。`, async () => {
    try {
      await restoreEventAgain(req);
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', 'イベントに戻りました', '参加者に「正しいですか？」の確認を送りました。');
    } catch (e) {
      console.error("イベント復帰エラー:", e);
      notice('error', 'エラー', 'イベントへの復帰に失敗しました。もう一度お試しください。');
    }
  });
};

// 「いや、抜けるで正しい」と再主張（削除した側）→ 相手にまた判断が飛ぶ
const reassertLeft = (req) => {
  askConfirm('削除（退出）を続けますか？', `${req.fromUserName || '相手'}さんに、もう一度「退出は正しい」と確認を送ります。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'event_left_check',
        trashId: req.trashId || null,
        eventId: req.eventId || null, eventName: req.eventName || '',
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("退出の再主張エラー:", e); }
  });
};

// 復帰の差し戻し（event_restore_rejected）に「正しくない」＝もう一度復帰
const reRestoreEvent = (req) => {
  askConfirm('もう一度復帰しますか？', `イベント「${req.eventName || ''}」に再び戻り、参加者に「正しいですか？」の確認を送ります。`, async () => {
    try {
      await restoreEventAgain(req);
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', '復帰しました', 'イベントに戻り、参加者に「正しいですか？」の確認を送りました。');
    } catch (e) {
      console.error("再復帰エラー:", e);
      notice('error', 'エラー', '復帰に失敗しました。もう一度お試しください。');
    }
  });
};

// --- 未精算戻しの判断ループ ---
// 拒否（settlement_restore_rejected）に「正しくない」＝もう一度依頼を送る
const reRequestRestore = (req) => {
  askConfirm('もう一度依頼しますか？', `「${req.itemName || ''}」を未精算に戻す依頼を、もう一度 ${req.fromUserName || '相手'}さんに送ります。`, async () => {
    try {
      const myUid = auth.currentUser?.uid;
      const found = await resolveTrashDoc(req); // 古い通知で trashId が無くても控えを探す
      if (found) { try { await updateDoc(doc(db, "trash", found.id), { status: 'pending' }); } catch (e) {} }
      await addDoc(collection(db, "notifications"), {
        toUserId: req.fromUserId, type: 'settlement_restore_request',
        trashId: found ? found.id : (req.trashId || null),
        eventId: req.eventId || null, eventName: req.eventName || '',
        historyId: req.historyId || null, itemName: req.itemName || '決済',
        amount: req.amount || 0, transactionIds: req.transactionIds || [],
        fromUserId: myUid, fromUserName: await getMyName(),
        isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
      notice('success', '依頼を送りました', `${req.fromUserName || '相手'}さんに、もう一度依頼を送りました。`);
    } catch (e) {
      console.error("再依頼エラー:", e);
      notice('error', 'エラー', '依頼の送信に失敗しました。もう一度お試しください。');
    }
  });
};

// ==========================================
// 🌟 「正しい／正しくない」で判断する通知タイプと振り分け
// ==========================================
const JUDGE_TYPES = [
  'payment_deleted', 'payment_delete_rejected', 'restore_check', 'restore_reverted',
  'event_left_check', 'event_left_rejected', 'event_restored', 'event_restore_rejected',
  'settlement_restore_rejected',
];
const isJudgeType = (t) => JUDGE_TYPES.includes(t);

// 「正しい」＝相手の主張・現状を受け入れる
const judgeOk = (req) => {
  switch (req.type) {
    case 'restore_check': return confirmRestoreOk(req);         // 復元を確定
    case 'payment_delete_rejected': return acceptDeleteRejection(req); // 削除をやめて元に戻す
    case 'event_left_rejected': return acceptLeftRejection(req);       // イベントに戻る
    default: return dismissNotif(req);                           // 受け入れて既読
  }
};

// 「正しくない」＝異議・再主張（相手にまた判断が飛ぶ）
const judgeNg = (req) => {
  switch (req.type) {
    case 'payment_deleted': return rejectPaymentDelete(req);
    case 'payment_delete_rejected': return reassertDelete(req);
    case 'restore_check': return confirmRestoreNg(req);
    case 'restore_reverted': return reRestorePayment(req);
    case 'event_left_check': return rejectEventLeft(req);
    case 'event_left_rejected': return reassertLeft(req);
    case 'event_restored': return rejectEventRestore(req);
    case 'event_restore_rejected': return reRestoreEvent(req);
    case 'settlement_restore_rejected': return reRequestRestore(req);
  }
};

const acceptRequest = async (request) => {
  if (!request.id || !request.formId) return;
  const myUid = auth.currentUser.uid;
  const friendUid = request.formId;

  try {
    await setDoc(doc(db, "users", myUid, "friends", friendUid), {
      uid: friendUid, name: request.formName || "名前なし", photo: request.formPhoto || "",
      isFriend: true, addedAt: serverTimestamp(), tradeCount: 0, isTrading: false
    });

    const myDoc = await getDoc(doc(db, "users", myUid));
    let myName = "名前なし", myPhoto = "";
    if (myDoc.exists()) {
      const myData = myDoc.data();
      myName = myData.name || "名前なし";
      myPhoto = myData.photo || myData.photoURL || "";
    }

    await setDoc(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid, name: myName, photo: myPhoto, isFriend: true, addedAt: serverTimestamp(), tradeCount: 0, isTrading: false
    });

    await addDoc(collection(db, "friendRequests"), {
      toId: friendUid, formId: myUid, formName: myName, formPhoto: myPhoto, status: "accepted", createdAt: serverTimestamp()
    });

    await deleteDoc(doc(db, "friendRequests", request.id));
    alert(`${request.formName}さんとフレンドになりました！`);
  } catch (error) {
    console.error("承認エラー:", error);
  }
};

const props = defineProps({ isStatic: { type: Boolean, default: false } });
const showModal = ref(false);
const open = () => { showModal.value = true; };
defineExpose({ open });
</script>

<style scoped>
.notification-wrapper.static-mode {
  height: 100vh;
  background-color: var(--c-surface);
}
.static-notification-panel {
  padding: 20px 20px 0;
  background-color: var(--c-surface);
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.sidebar-title {
  font-size: 18px; font-weight: var(--fw-bold); margin-bottom: 16px;
  color: var(--c-ink);
}

/* ベルアイコン */
.icon-btn {
  padding: 4px; position: relative; display: flex;
  color: var(--c-text);
}
.icon-btn:active { transform: scale(0.9); }
.notification-dot {
  position: absolute; top: 2px; right: 3px;
  width: 9px; height: 9px; background-color: var(--c-danger);
  border-radius: 50%; border: 2px solid var(--c-surface);
}

/* モーダル */
.modal-overlay {
  position: fixed; inset: 0;
  background-color: var(--c-overlay);
  z-index: 9000; /* ヘッダー(1000)より上・確認用BaseModal(99999)より下に置き、確認が前面に出るように */
  display: flex; justify-content: center; align-items: center;
  padding: 20px;
}
.modal-window {
  width: 100%;
  max-width: 360px;
  max-height: 78vh;
  background-color: var(--c-surface);
  border-radius: var(--r-xl);
  padding: 22px;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-pop);
}
.modal-title {
  font-size: 18px; font-weight: var(--fw-bold); margin-bottom: 16px;
  color: var(--c-ink); text-align: center;
  flex-shrink: 0;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 2px 6px;
  scrollbar-width: none;
}
.notification-list::-webkit-scrollbar { display: none; }

/* 通知カード（左アクセント） */
.notif-item {
  background: var(--c-surface-2);
  border-radius: var(--r-md);
  border-left: 3px solid var(--c-line-bold);
  padding: 13px 15px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--c-text);
  flex-shrink: 0;
}
.notif-item--pay { border-left-color: var(--c-pay); }
.notif-item--friend { border-left-color: var(--c-brand); }
.notif-item--reject { border-left-color: var(--c-danger); }
.notif-item--info { border-left-color: var(--c-brand); }

.notif-body { display: flex; flex-direction: column; gap: 8px; }
.notif-body p { font-weight: var(--fw-medium); color: var(--c-ink); }
.notif-sub { font-size: 12px; color: var(--c-text-sub) !important; font-weight: var(--fw-medium); }
.notif-changes { font-size: 12px; color: var(--c-brand-strong, var(--c-brand)) !important; font-weight: var(--fw-bold, 700); background: var(--c-brand-weak); border-radius: 8px; padding: 6px 10px; line-height: 1.5; }
/* 送信者が添えた自由メッセージ（相手の言葉として引用ブロックで見せる） */
.notif-msg { font-size: 13px; color: var(--c-text) !important; font-weight: var(--fw-bold, 700) !important; background: var(--c-surface-2); border-left: 3px solid var(--c-line-strong); border-radius: 8px; padding: 8px 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.notif-actions { display: flex; justify-content: flex-end; gap: 8px; }

.mini-btn {
  align-self: flex-end;
  background: var(--c-brand);
  color: #fff;
  padding: 6px 14px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: var(--fw-bold);
  transition: transform 0.12s ease;
}
.mini-btn:active { transform: scale(0.95); }
.mini-btn--ghost {
  background: var(--c-surface);
  color: var(--c-text-sub);
  border: 1px solid var(--c-line-bold);
}

.empty-msg {
  text-align: center; color: var(--c-text-faint); font-size: 14px;
  font-weight: var(--fw-medium); padding: 40px 0;
}

.close-modal-btn {
  margin-top: 16px;
  padding: 13px;
  background: var(--c-surface-2);
  color: var(--c-text-sub);
  border-radius: var(--r-pill);
  font-weight: var(--fw-bold);
  font-size: 15px;
  flex-shrink: 0;
}
.close-modal-btn:active { transform: scale(0.97); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
