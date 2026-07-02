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
    type="success"
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
  collection, query, where, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore';

const router = useRouter();
const friendReqs = ref([]);
const paymentReqs = ref([]);

// 通知タイプごとの表示文言・ボタン
const notifText = (req) => {
  if (req.type === 'approval_rejected') return 'さんがあなたの承認リクエストを拒否しました';
  if (req.type === 'payment_reminder') return 'さんから支払いの催促が届いています';
  if (req.type === 'payment_edited') return `さんが「${req.itemName || '支払い'}」（¥${(req.amount || 0).toLocaleString()}）を編集しました`;
  if (req.type === 'payment_deleted') return `さんが「${req.itemName || '支払い'}」（¥${(req.amount || 0).toLocaleString()}）を削除しました`;
  if (req.type === 'event_edited') return `さんがイベント「${req.eventName || ''}」を編集しました`;
  if (req.type === 'event_invite') return `さんがイベント「${req.eventName || ''}」に招待しています。心当たりはありますか？`;
  if (req.type === 'invite_rejected') return `さんがイベント「${req.eventName || ''}」への招待を拒否しました。内容が正しいか再確認してください`;
  if (req.type === 'event_joined') return `さんがイベント「${req.eventName || ''}」に参加しました`;
  if (req.type === 'event_restored') return `さんがイベント「${req.eventName || ''}」を復元しました`;
  if (req.type === 'settlement_restore_request') return `さんが決済「${req.itemName || ''}」（¥${(req.amount || 0).toLocaleString()}）を未精算に戻したいそうです。承認しますか？`;
  if (req.type === 'settlement_restore_approved') return `さんが「${req.itemName || ''}」を未精算に戻すことを承認しました`;
  if (req.type === 'settlement_restore_rejected') return `さんが「${req.itemName || ''}」を未精算に戻すことを拒否しました`;
  if (req.type === 'payment_completed') return 'さんとの支払いが完了しました！';
  return 'さんから支払いの承認リクエストが届いています';
};
const notifAction = (req) => {
  if (req.type === 'approval_rejected') return 'もう一度支払う';
  if (req.type === 'payment_reminder') return '支払う';
  if (['payment_edited', 'event_edited', 'invite_rejected', 'event_joined', 'event_restored', 'settlement_restore_approved', 'settlement_restore_rejected'].includes(req.type)) return 'イベントを見る';
  if (req.type === 'payment_deleted' || req.type === 'payment_completed') return '確認';
  return '詳細を確認する';
};
const notifClass = (req) => {
  if (['approval_rejected', 'invite_rejected', 'settlement_restore_rejected'].includes(req.type)) return 'notif-item--reject';
  if (['payment_edited', 'payment_deleted', 'event_edited', 'event_joined', 'event_restored', 'settlement_restore_approved', 'payment_completed'].includes(req.type)) return 'notif-item--info';
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
    if (['payment_edited', 'payment_deleted', 'event_edited', 'invite_rejected', 'event_joined', 'event_restored', 'settlement_restore_approved', 'settlement_restore_rejected'].includes(req.type)) {
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
        eventId: req.eventId || null, eventName: req.eventName || '', itemName: req.itemName || '',
        fromUserId: myUid, fromUserName: myName, isRead: false, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "notifications", req.id), { isRead: true });
    } catch (e) { console.error("復元拒否エラー:", e); }
  });
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
  background-color: rgba(15, 23, 42, 0.5);
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
.notif-item--info { border-left-color: var(--c-brand, #059669); }

.notif-body { display: flex; flex-direction: column; gap: 8px; }
.notif-body p { font-weight: var(--fw-medium); color: var(--c-ink); }
.notif-sub { font-size: 12px; color: var(--c-text-sub) !important; font-weight: var(--fw-medium); }
.notif-changes { font-size: 12px; color: var(--c-brand-strong, #059669) !important; font-weight: var(--fw-bold, 700); background: var(--c-brand-weak, #ecfdf5); border-radius: 8px; padding: 6px 10px; line-height: 1.5; }
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
