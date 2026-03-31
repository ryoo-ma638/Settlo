<template>
  <div class="friend-container">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1 class="page-title">フレンドリスト</h1>
      <div class="spacer"></div>
    </header>

    <main class="content">
      <div class="fixed-top-items">
        <button class="add-friend-main-button" @click="isModalOpen = true">
          <span class="icon">＋</span> 友達を追加する
        </button>
        
        <div class="request-section" v-if="pendingRequests.length > 0">
          <p class="request-alert">
            <span class="alert-icon">🔔</span> 友達申請が届いています
          </p>
          <div class="request-card" v-for="req in pendingRequests" :key="req.id">
            <div class="request-avatar-wrapper">
              <img 
                v-if="req.formPhoto" 
                :src="req.formPhoto" 
                class="request-avatar-img"
              />
              <div v-else class="request-avatar-placeholder" :style="{ backgroundColor: req.color || '#8bb4ff' }"></div>
            </div>
            <span class="request-name">{{ req.formName }}</span>
            <button class="approve-button" @click="openApproveModal(req)">確認</button>
          </div>
        </div>

        <div class="list-header-row">
          <h2 class="list-title">友達リスト</h2>
        </div>

        <div class="control-panel">
          <div class="select-wrapper">
            <select v-model="currentFilter" class="custom-select">
              <option value="all">すべて表示</option>
              <option value="friend_only">フレンドのみ</option> 
              <option value="trading">取引中</option>
              <option value="not_friend">取引あり（未フレンド）</option>
            </select>
          </div>
          <div class="select-wrapper">
            <select v-model="currentSort" class="custom-select">
              <option value="added_desc">追加順</option>
              <option value="kana_asc">あいうえお順</option>
              <option value="trade_desc">取引多い順</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="friend-scroll-area">
        <FriendCard 
          v-for="user in processedList" 
          :key="user.id" 
          :user="user" 
          @click="navigateToDetail(user)" 
        />
        <div v-if="processedList.length === 0" class="empty-msg">
          <span class="empty-icon">👥</span>
          <p>該当するユーザーがいません。</p>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
      
      <FriendApproveModal 
        :isOpen="isApproveModalOpen" 
        :requestUser="selectedRequestUser" 
        @close="isApproveModalOpen = false" 
        @approve="handleApproveDone" 
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
      });
    }
  });
});

const isApproveModalOpen = ref(false);
const selectedRequestUser = ref(null);

const openApproveModal = (user) => {
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
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
  
  return [...list].sort((a, b) => {
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
.friend-container { 
  font-family: 'Noto Sans JP', sans-serif;
  min-height: 100vh; 
  background-color: #f8fafc; /* 全体の統一背景色 */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

/* 🌟 新しく追加したおしゃれなグラデーションヘッダー */
.page-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 16px 20px; 
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); /* 🌟 フレンドリーなスカイブルー */
  position: sticky; 
  z-index: 100;
  border-radius: 0 0 24px 24px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  margin-bottom: 15px;
}
.back-btn { background: none; border: none; font-size: 32px; color: #0f172a; cursor: pointer; padding: 0; display: flex; align-items: center; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.page-title { font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; flex: 1; text-align: center; }
.spacer { width: 32px; }

.content { padding: 5px 20px 100px 20px; flex: 1; display: flex; flex-direction: column; }
.fixed-top-items { margin-bottom: 15px; }

/* 🌟 友達追加ボタンをリッチに */
.add-friend-main-button { 
  width: 100%; 
  padding: 18px; 
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white; 
  border: none; 
  border-radius: 20px; 
  font-size: 16px; 
  font-weight: 900; 
  margin-bottom: 25px; 
  cursor: pointer; 
  box-shadow: 0 8px 20px rgba(59,130,246,0.25); 
  transition: 0.2s; 
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.add-friend-main-button:active { transform: scale(0.96); }
.add-friend-main-button .icon { font-size: 20px; }

/* 申請カードの洗練 */
.request-alert { font-weight: 900; font-size: 14px; margin-bottom: 12px; color: #ef4444; display: flex; align-items: center; gap: 6px; }
.request-card { background-color: white; display: flex; align-items: center; padding: 16px; border-radius: 20px; margin-bottom: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; }
.request-avatar-wrapper { width: 48px; height: 48px; flex-shrink: 0; margin-right: 15px; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden; background: #e2e8f0; }
.request-avatar-placeholder { width: 100%; height: 100%; }
.request-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.request-name { flex: 1; font-size: 16px; font-weight: 900; color: #1e293b; }
.approve-button { background-color: #ecfdf5; color: #10b981; border: 1px solid #a7f3d0; padding: 8px 20px; border-radius: 16px; font-size: 13px; font-weight: 900; cursor: pointer; transition: 0.2s; }
.approve-button:active { transform: scale(0.95); background-color: #d1fae5; }

/* リストコントロール */
.list-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.list-title { font-size: 18px; font-weight: 900; color: #0f172a; margin: 0; }

.control-panel { display: flex; gap: 10px; margin-bottom: 20px; }
.select-wrapper { flex: 1; position: relative; }
.custom-select { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid #cbd5e1; background-color: white; font-size: 13px; font-weight: 800; color: #475569; outline: none; appearance: none; -webkit-appearance: none; cursor: pointer; }
.select-wrapper::after { content: '▾'; position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #94a3b8; pointer-events: none; }

.friend-scroll-area { display: flex; flex-direction: column; gap: 12px; flex: 1; }
.empty-msg { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; color: #94a3b8; }
.empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }
.empty-msg p { margin: 0; font-weight: 800; font-size: 14px; }
</style>