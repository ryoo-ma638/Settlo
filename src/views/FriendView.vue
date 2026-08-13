<template>
  <div class="friend">
    <header class="screen-head">
      <h1 class="screen-head__title">フレンド</h1>
    </header>

    <main class="friend__body">
      <button class="btn-brand friend__add" data-tour="friend-add" @click="isModalOpen = true">
        <svg class="friend__add-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        友達を追加する
      </button>

      <div class="reqs" v-if="pendingRequests.length > 0">
        <p class="reqs__alert">
          友達申請が届いています
          <span class="reqs__count">{{ pendingRequests.length }}</span>
        </p>
        <div class="reqcard" v-for="req in pendingRequests" :key="req.id">
          <UserAvatar class="reqcard__avatar" :name="req.formName" :photo="req.formPhoto" :size="46" />
          <span class="reqcard__name">{{ req.formName }}</span>
          <button class="reqcard__btn" @click="openApproveModal(req)">確認</button>
        </div>
      </div>

      <h2 class="friend__list-title">友達リスト</h2>

      <div class="controls">
        <div class="select">
          <select v-model="currentFilter">
            <option value="all">すべて表示</option>
            <option value="friend_only">フレンドのみ</option>
            <option value="trading">取引中</option>
            <option value="not_friend">取引あり（未フレンド）</option>
          </select>
        </div>
        <div class="select">
          <select v-model="currentSort">
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
            v-for="user in processedList"
            :key="user.id"
            :user="user"
            @click="navigateToDetail(user)"
          />
          <div v-if="processedList.length === 0" class="empty-box">
            <template v-if="friendData.length === 0">
              <p class="empty-box__title">まだフレンドがいません</p>
              <p class="empty-box__desc">上の「友達を追加する」からIDを検索して追加できます</p>
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
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';

import { auth, db } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,  query,  where,  onSnapshot,
  doc,  getDoc,  setDoc,  deleteDoc, addDoc,  serverTimestamp
} from 'firebase/firestore';

import FriendAddModal from '@/components/FriendAddModal.vue';
import FriendCard from '@/components/FriendCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import SkeletonRows from '@/components/SkeletonRows.vue';
import FriendApproveModal from '@/components/FriendApproveModal.vue';
import BaseModal from '@/components/BaseModal.vue';

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
const loading = ref(true); // フレンド一覧の初回読込中は true（スケルトン表示）
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
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const qReq = query(
        collection(db, "friendRequests"),
        where("toId", "==", user.uid),
        where("status", "==", "pending")
      );
      onSnapshot(qReq, (snapshot) => {
        pendingRequests.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            formPhoto: data.formPhoto || data.photo || data.photoURL || ""
          };
        });
      });

      // 相手ごとの残高（受取＝相手が自分に払う／支払＝自分が相手に払う・未完了のみ）
      onSnapshot(query(collection(db, "transactions"), where("paidToId", "==", user.uid)), (snap) => {
        for (const k in recvByUid) delete recvByUid[k];
        snap.docs.forEach(d => { const t = d.data(); if (t.paidById && (t.status || 'unpaid') !== 'completed') recvByUid[t.paidById] = (recvByUid[t.paidById] || 0) + (t.amount || 0); });
        rebuildBalance();
      }, () => {});
      onSnapshot(query(collection(db, "transactions"), where("paidById", "==", user.uid)), (snap) => {
        for (const k in payByUid) delete payByUid[k];
        snap.docs.forEach(d => { const t = d.data(); if (t.paidToId && (t.status || 'unpaid') !== 'completed') payByUid[t.paidToId] = (payByUid[t.paidToId] || 0) + (t.amount || 0); });
        rebuildBalance();
      }, () => {});

      const qFriends = collection(db, "users", user.uid, "friends");
      onSnapshot(qFriends, (snapshot) => {
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

const openApproveModal = (user) => {
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
};

// 🌟 「知らない人」としてフレンド申請を拒否（申請を削除）
const handleRejectRequest = async (request) => {
  try {
    if (request?.id) {
      await deleteDoc(doc(db, "friendRequests", request.id));
    }
    isApproveModalOpen.value = false;
    showModal({ type: 'info', title: '申請を拒否しました', message: '心当たりのない申請を削除しました。' });
  } catch (error) {
    console.error("申請拒否エラー:", error);
    showModal({ type: 'error', title: 'エラー', message: '申請の拒否に失敗しました。' });
  }
};

const handleApproveDone = async (request) => {
  if (!request.formId) {
    showModal({ type: 'error', title: 'エラー', message: 'この申請データには送信者ID(fromId)が含まれていないため、承認できません。' });
    return;
  }

  const myUid = auth.currentUser.uid;
  const friendUid = request.formId;

  try {
    await setDoc(doc(db, "users", myUid, "friends", request.formId), {
      uid: request.formId,
      name: request.formName,
      photo: request.formPhoto || "",
      isFriend: true,
      isTrading: false,
      tradeCount: 0,
      addedAt: serverTimestamp()
    });

    const myDoc = await getDoc(doc(db, "users", myUid));
    let myName = "名前なし";
    let myPhoto = "";

    if (myDoc.exists()) {
      const myData = myDoc.data();
      myName = myData.name || "名前なし";
      myPhoto = myData.photo || "";
    }

    await setDoc(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid,
      name: myName,
      photo: myPhoto || "",
      isFriend: true,
      addedAt: serverTimestamp(),
      tradeCount: 0,
      isTrading: false
    });

    await addDoc(collection(db, "friendRequests"), {
      toId: friendUid,
      formId: myUid,
      formName: myName,
      photo: myPhoto,
      status: "accepted",
      createdAt: serverTimestamp()
    });

    await deleteDoc(doc(db, "friendRequests", request.id));

    isApproveModalOpen.value = false;
  } catch (error) {
    console.error("承認エラーの詳細:", error);
    showModal({ type: 'error', title: '承認エラー', message: '承認に失敗しました。もう一度試すか、電波状況を確認してください。' });
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
    .map(u => ({ ...u, net: balanceByUid.value[u.uid || u.id] || 0 })) // 相手ごとの残高を付与
    .sort((a, b) => {
      if (currentSort.value === 'kana_asc') {
        return (a.kana || "").localeCompare(b.kana || "", 'ja');
      }
      const timeA = a.addedAt?.seconds || 0;
      const timeB = b.addedAt?.seconds || 0;
      return timeB - timeA;
    });
});

const navigateToDetail = (friend) => {
  const uid = friend.uid || friend.id;

  if (!uid) {
    console.error("UIDが見つかりません:", friend);
    return;
  }

  router.push({
    path: `/friend/${encodeURIComponent(friend.name)}/${uid}`,
    query: { uid: uid }
  });
};
</script>

<style scoped>
.friend__body { padding: 6px var(--pad) 28px; }

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
