<template>
  <div class="friend">
    <header class="screen-head">
      <h1 class="screen-head__title">{{ pickSplit ? '割り勘する相手' : 'フレンド' }}</h1>
    </header>

    <main class="friend__body">
      <p v-if="pickSplit" class="friend__pickhint">割り勘を記録する相手を選んでください。</p>
      <button class="btn-brand friend__add" data-tour="friend-add" @click="isModalOpen = true">
        <svg class="friend__add-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        フレンドを追加
      </button>

      <div class="reqs" v-if="!pickSplit && pendingRequests.length > 0">
        <p class="reqs__alert">
          フレンド申請が届いています
          <span class="reqs__count">{{ pendingRequests.length }}</span>
        </p>
        <div class="reqcard" v-for="req in pendingRequests" :key="req.id">
          <UserAvatar class="reqcard__avatar" :name="req.formName" :photo="req.formPhoto" :size="46" />
          <span class="reqcard__name">{{ req.formName }}</span>
          <button
            class="reqcard__btn"
            :disabled="approvalStateFor(req) === 'loading' || approvalStateFor(req) === 'saving'"
            @click="openApproveModal(req)"
          >{{ approvalStateLabel(req) }}</button>
        </div>
      </div>

      <h2 v-if="!pickSplit" class="friend__list-title">フレンド一覧</h2>

      <div v-if="!pickSplit" class="controls">
        <div class="select">
          <select v-model="currentFilter" aria-label="フレンドの絞り込み">
            <option value="all">すべて表示</option>
            <option value="friend_only">フレンドのみ</option>
            <option value="trading">取引あり</option>
            <option value="not_friend">取引あり（フレンド以外）</option>
          </select>
        </div>
        <div class="select">
          <select v-model="currentSort" aria-label="フレンドの並び順">
            <option value="added_desc">追加順</option>
            <option value="kana_asc">あいうえお順</option>
            <option value="trade_desc">取引多い順</option>
          </select>
        </div>
      </div>

      <div class="friend__list">
        <SkeletonRows v-if="loading" :rows="5" :amount="false" />
        <template v-else>
          <FriendCard
            v-for="(user, index) in processedList"
            :key="user.id"
            :user="user"
            :data-tour="index === 0 ? 'friend-row' : null"
            @click="navigateToDetail(user)"
          />
          <div v-if="processedList.length === 0" class="empty-box">
            <template v-if="friendData.length === 0">
              <p class="empty-box__title">まだフレンドがいません</p>
              <p class="empty-box__desc">上の「フレンドを追加」から名前やIDで検索できます</p>
            </template>
            <template v-else>絞り込みに合うフレンドがいません</template>
          </div>
        </template>
      </div>
    </main>

    <Teleport to="body">
      <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />

      <FriendApproveModal
        :isOpen="isApproveModalOpen"
        :requestUser="selectedRequestUser"
        :saving="approvalSaving"
        :approvalState="selectedRequestUser ? approvalStateFor(selectedRequestUser) : 'loading'"
        @close="isApproveModalOpen = false"
        @approve="handleApproveDone"
        @reject="handleRejectRequest"
      />

      <BaseModal
        :show="modalState.show"
        :type="modalState.type"
        :title="modalState.title"
        :message="modalState.message"
        :showCancel="modalState.showCancel"
        :confirmText="modalState.confirmText"
        :cancelText="modalState.cancelText"
        @confirm="handleConfirmModal"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue';
import { countFriendTransactions, summarizeFriendTransactions } from '../lib/friendTransactionCounts.js';
import { useRoute, useRouter } from 'vue-router';

import { auth, db } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,  query,  where,  onSnapshot,
  doc, getDoc, getDocFromServer, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, writeBatch
} from 'firebase/firestore';

import FriendAddModal from '@/components/FriendAddModal.vue';
import FriendCard from '../components/FriendCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import SkeletonRows from '@/components/SkeletonRows.vue';
import FriendApproveModal from '@/components/FriendApproveModal.vue';
import BaseModal from '@/components/BaseModal.vue';

const route = useRoute();
const router = useRouter();
const isModalOpen = ref(false);

const currentFilter = ref('all');
const currentSort = ref('added_desc');

// 🌟 モーダル状態管理
const modalState = reactive({
  show: false, type: 'info', title: '', message: '',
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
};
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

// 決済保存時などに呼び出す関数
const addTradingUserToList = async (targetUser) => {
  const myUid = auth.currentUser.uid;
  const friendUid = targetUser.uid;

  const friendRef = doc(db, "users", myUid, "friends", friendUid);
  const friendDoc = await getDoc(friendRef);

  if (!friendDoc.exists()) {
    await setDoc(friendRef, {
      uid: friendUid,
      name: targetUser.name,
      photo: targetUser.photo || targetUser.photoURL || "",
      isFriend: false,
      isTrading: true,
      addedAt: serverTimestamp(),
      tradeCount: 1
    });
  } else {
    await updateDoc(friendRef, { isTrading: true });
  }
};

const friendData = ref([]);
const pendingRequests = ref([]);
const pendingRequestsError = ref(false);
const loading = ref(true); // フレンド一覧の初回読込中は true（スケルトン表示）
const countUid = ref(null);
const countRows = reactive({ received: [], paid: [] });
const countState = reactive({ received: 'loading', paid: 'loading' });
const tradeCountState = computed(() => Object.values(countState).includes('error') ? 'error'
  : Object.values(countState).every(s => s === 'ready') ? 'ready' : 'loading');
const tradeCounts = computed(() => countFriendTransactions([...countRows.received, ...countRows.paid], countUid.value));
const settlementCounts = computed(() => summarizeFriendTransactions([...countRows.received, ...countRows.paid], countUid.value));
let stopAuth = null;
let subscriptions = [];
let generation = 0;
const stopSubscriptions = () => {
  generation++;
  subscriptions.forEach(stop => stop());
  subscriptions = [];
};
onUnmounted(() => { stopAuth?.(); stopSubscriptions(); });
const balanceByUid = ref({}); // 相手UID → net（>0=受け取る / <0=支払う。全イベント横断）
// 相手ごとの受取/支払を集計して net を更新
const recvByUid = {}; const payByUid = {};
const rebuildBalance = () => {
  const out = {};
  const uids = new Set([...Object.keys(recvByUid), ...Object.keys(payByUid)]);
  uids.forEach(uid => { out[uid] = (recvByUid[uid] || 0) - (payByUid[uid] || 0); });
  balanceByUid.value = out;
};

onMounted(() => {
  stopAuth = onAuthStateChanged(auth, (user) => {
    stopSubscriptions();
    const currentGeneration = generation;
    const listen = (reference, next, error = () => {}) => {
      subscriptions.push(onSnapshot(reference,
        snapshot => { if (generation === currentGeneration) next(snapshot); },
        failure => { if (generation === currentGeneration) error(failure); }));
    };
    countUid.value = user?.uid || null;
    countRows.received = []; countRows.paid = [];
    countState.received = 'loading'; countState.paid = 'loading';
    friendData.value = []; pendingRequests.value = [];
    for (const uid in recvByUid) delete recvByUid[uid];
    for (const uid in payByUid) delete payByUid[uid];
    rebuildBalance();
    loading.value = Boolean(user);
    if (user) {
      const qReq = query(
        collection(db, "friendRequests"),
        where("toId", "==", user.uid),
        where("status", "==", "pending")
      );
      listen(qReq, (snapshot) => {
        pendingRequestsError.value = false;
        pendingRequests.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            formPhoto: data.formPhoto || data.photo || data.photoURL || ""
          };
        });
        pendingRequests.value.forEach(request => verifyApprovalRequest(request));
      }, () => {
        pendingRequestsError.value = true;
        pendingRequests.value = [];
      });

      // 相手ごとの残高（受取＝相手が自分に払う／支払＝自分が相手に払う・未完了のみ）
      listen(query(collection(db, "transactions"), where("paidToId", "==", user.uid)), (snap) => {
        countRows.received = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        countState.received = 'ready';
        for (const k in recvByUid) delete recvByUid[k];
        snap.docs.forEach(d => { const t = d.data(); if (t.paidById && (t.status || 'unpaid') !== 'completed') recvByUid[t.paidById] = (recvByUid[t.paidById] || 0) + (t.amount || 0); });
        rebuildBalance();
      }, () => { countRows.received = []; countState.received = 'error'; });
      listen(query(collection(db, "transactions"), where("paidById", "==", user.uid)), (snap) => {
        countRows.paid = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        countState.paid = 'ready';
        for (const k in payByUid) delete payByUid[k];
        snap.docs.forEach(d => { const t = d.data(); if (t.paidToId && (t.status || 'unpaid') !== 'completed') payByUid[t.paidToId] = (payByUid[t.paidToId] || 0) + (t.amount || 0); });
        rebuildBalance();
      }, () => { countRows.paid = []; countState.paid = 'error'; });

      const qFriends = collection(db, "users", user.uid, "friends");
      listen(qFriends, (snapshot) => {
        friendData.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            photo: data.photo || data.photoURL || ""
          };
        });
        loading.value = false; // フレンド一覧が届いたらスケルトン解除
      });
    } else {
      loading.value = false; // 未ログインなら待たない
    }
  });
});

const isApproveModalOpen = ref(false);
const selectedRequestUser = ref(null);
const approvalSaving = ref(false);
const approvalStates = ref({});
const approvalCheckVersions = new Map();
const unknownStorageKey = 'settlo-approval-unknown-requests';
const storedUnknownIds = (() => {
  try { return new Set(JSON.parse(sessionStorage.getItem(unknownStorageKey) || '[]')); }
  catch { return new Set(); }
})();

const saveUnknownIds = () => {
  try { sessionStorage.setItem(unknownStorageKey, JSON.stringify([...storedUnknownIds])); }
  catch {}
};
const setApprovalState = (requestId, state) => {
  approvalStates.value = { ...approvalStates.value, [requestId]: state };
};
const markApprovalUnknown = (requestId) => {
  if (!requestId) return;
  storedUnknownIds.add(requestId);
  saveUnknownIds();
  setApprovalState(requestId, 'unknown');
};
const verifyApprovalRequest = async (request) => {
  if (!request?.id || !request.formId || !auth.currentUser?.uid) {
    if (request?.id) setApprovalState(request.id, 'unknown');
    return 'unknown';
  }
  const version = (approvalCheckVersions.get(request.id) || 0) + 1;
  approvalCheckVersions.set(request.id, version);
  setApprovalState(request.id, 'loading');
  try {
    const currentFriend = await getDocFromServer(doc(db, 'users', auth.currentUser.uid, 'friends', request.formId));
    if (approvalCheckVersions.get(request.id) !== version) return approvalStates.value[request.id];
    if (currentFriend.exists()) {
      markApprovalUnknown(request.id);
      return 'unknown';
    }
    storedUnknownIds.delete(request.id);
    saveUnknownIds();
    setApprovalState(request.id, 'ready');
    return 'ready';
  } catch {
    markApprovalUnknown(request.id);
    return 'unknown';
  }
};
const approvalStateFor = (request) => {
  if (approvalSaving.value && selectedRequestUser.value?.id === request?.id) return 'saving';
  if (pendingRequestsError.value || storedUnknownIds.has(request?.id)) return 'unknown';
  return approvalStates.value[request?.id] || 'loading';
};
const approvalStateLabel = (request) => ({
  loading: '確認中…', ready: '確認', saving: '承認中…', unknown: '状態を確認',
}[approvalStateFor(request)]);

const openApproveModal = async (user) => {
  if (approvalSaving.value) return;
  if (approvalStateFor(user) === 'unknown') await verifyApprovalRequest(user);
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
};

// 🌟 「知らない人」としてフレンド申請を拒否（申請を削除）
const handleRejectRequest = async (request) => {
  if (approvalSaving.value) return;
  try {
    if (request?.id) {
      await deleteDoc(doc(db, "friendRequests", request.id));
    }
    isApproveModalOpen.value = false;
    showModal({ type: 'info', title: '申請を拒否しました', message: 'フレンド申請を一覧から削除しました。' });
  } catch (error) {
    console.error("申請拒否エラー:", error);
    showModal({ type: 'error', title: 'エラー', message: '申請の拒否に失敗しました。' });
  }
};

const handleApproveDone = async (request) => {
  if (approvalSaving.value) return;
  if (approvalStateFor(request) !== 'ready') return;
  if (!request.formId) {
    showModal({ type: 'error', title: 'エラー', message: 'この申請データには送信者ID(fromId)が含まれていないため、承認できません。' });
    return;
  }

  const myUid = auth.currentUser?.uid;
  if (!myUid) {
    showModal({ type: 'error', title: 'エラー', message: 'ログイン状態を確認して、一覧から開き直してください。' });
    return;
  }
  const friendUid = request.formId;
  approvalSaving.value = true;
  markApprovalUnknown(request.id);

  try {
    const myDoc = await getDoc(doc(db, "users", myUid));
    let myName = "名前なし";
    let myPhoto = "";

    if (myDoc.exists()) {
      const myData = myDoc.data();
      myName = myData.name || "名前なし";
      myPhoto = myData.photo || "";
    }

    const batch = writeBatch(db);
    batch.set(doc(db, "users", myUid, "friends", request.formId), {
      uid: request.formId,
      name: request.formName,
      photo: request.formPhoto || "",
      isFriend: true,
      isTrading: false,
      tradeCount: 0,
      addedAt: serverTimestamp()
    });
    batch.set(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid,
      name: myName,
      photo: myPhoto || "",
      isFriend: true,
      addedAt: serverTimestamp(),
      tradeCount: 0,
      isTrading: false
    });
    batch.set(doc(collection(db, "friendRequests")), {
      toId: friendUid,
      formId: myUid,
      formName: myName,
      photo: myPhoto,
      status: "accepted",
      createdAt: serverTimestamp()
    });
    batch.delete(doc(db, "friendRequests", request.id));
    await batch.commit();

    isApproveModalOpen.value = false;
    selectedRequestUser.value = null;
    storedUnknownIds.delete(request.id);
    saveUnknownIds();
    showModal({ type: 'success', title: '承認完了', message: `${request.formName}さんとフレンドになりました。` });
  } catch (error) {
    console.error("承認エラーの詳細:", error);
    isApproveModalOpen.value = false;
    selectedRequestUser.value = null;
    const state = await verifyApprovalRequest(request);
    showModal(state === 'ready'
      ? { type: 'error', title: '承認を保存できませんでした', message: '保存が始まっていないことを確認しました。通信状況を確認してから、もう一度お試しください。' }
      : { type: 'error', title: '承認結果を確認できません', message: '途中まで保存された可能性があります。状態を確認できるまで、同じ申請をもう一度承認しないでください。' });
  } finally {
    approvalSaving.value = false;
  }
};

const processedList = computed(() => {
  let list = friendData.value;
  if (currentFilter.value === 'trading') {
    list = list.filter(u => u.isTrading);
  } else if (currentFilter.value === 'friend_only') {
    list = list.filter(u => u.isFriend === true);
  } else if (currentFilter.value === 'not_friend') {
    list = list.filter(u => u.isFriend === false || u.isFriend === undefined);
  }

  return [...list]
    .map(u => ({ ...u, net: balanceByUid.value[u.uid || u.id] || 0,
      tradeCount: tradeCountState.value === 'ready' ? (tradeCounts.value.get(u.uid || u.id) || 0) : null,
      tradeCountState: tradeCountState.value,
      settlement: tradeCountState.value === 'ready' ? (settlementCounts.value.get(u.uid || u.id) || { unsettled: 0, myConfirmation: 0, theirConfirmation: 0 }) : null })) // 相手ごとの残高を付与
    .sort((a, b) => {
      if (currentSort.value === 'trade_desc') {
        const byCount = (b.tradeCount ?? -1) - (a.tradeCount ?? -1);
        if (byCount) return byCount;
      }
      if (currentSort.value === 'kana_asc') {
        return (a.kana || "").localeCompare(b.kana || "", 'ja');
      }
      const timeA = a.addedAt?.seconds || 0;
      const timeB = b.addedAt?.seconds || 0;
      return timeB - timeA;
    });
});

// 🌟 ＋の「フレンドと割り勘」から相手を選ぶモード（?pick=split）
//    イベント側の ?pick=payment と同じ考え方で、一覧を選ぶだけの画面にする。
const pickSplit = computed(() => route.query.pick === 'split');

const navigateToDetail = (friend) => {
  const uid = friend.uid || friend.id;

  if (!uid) {
    console.error("UIDが見つかりません:", friend);
    return;
  }

  router.push({
    path: `/friend/${encodeURIComponent(friend.name)}/${uid}`,
    query: pickSplit.value ? { uid, split: '1' } : { uid }
  });
};
</script>

<style scoped>
.friend__body { padding: 6px var(--pad) 28px; }

.friend__pickhint {
  margin: 2px 0 14px;
  font-size: 13px;
  color: var(--c-text-sub, #6b7280);
}

.friend__add { margin-bottom: 22px; }
.friend__add-icon {
  width: 20px; height: 20px;
  fill: none; stroke: #fff; stroke-width: 2.4; stroke-linecap: round;
}

/* 友達申請 */
.reqs { margin-bottom: 22px; }
/* 申請はエラーではないので赤を使わず、件数バッジで気づかせる */
.reqs__alert {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: var(--fw-bold);
  font-size: 13px;
  color: var(--c-ink);
  margin-bottom: 10px;
}
.reqs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: var(--c-brand);
  color: #fff;
  font-size: 12px;
  font-weight: var(--fw-black);
  line-height: 1;
}
.reqcard {
  display: flex; align-items: center; gap: 14px;
  background: var(--c-surface);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
  margin-bottom: 10px;
}
.reqcard__name { flex: 1; font-size: 16px; font-weight: var(--fw-bold); color: var(--c-ink); }
.reqcard__btn {
  background: var(--c-brand-weak); color: var(--c-brand-strong);
  padding: 8px 18px; border-radius: var(--r-pill);
  font-size: 13px; font-weight: var(--fw-bold);
}
.reqcard__btn:active { transform: scale(0.95); }

.friend__list-title {
  font-size: 16px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin-bottom: 12px;
}

/* フィルター */
.controls { display: flex; gap: 10px; margin-bottom: 16px; }
.select { flex: 1; position: relative; }
.select select {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--c-line-bold);
  background: var(--c-surface);
  font-size: 13px;
  font-weight: var(--fw-bold);
  color: var(--c-text);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.select::after {
  content: '▾';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--c-text-faint);
  pointer-events: none;
}

.friend__list { display: flex; flex-direction: column; gap: 12px; }
</style>
