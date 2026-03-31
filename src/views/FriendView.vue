<template>
  <div class="friend-container">
    <main class="content">
      <div class="fixed-top-items">
        <button class="add-friend-main-button" @click="isModalOpen = true">
          友達を追加する
        </button>
        
        <div class="request-section" v-if="pendingRequests.length > 0">
          <p class="request-alert">❗ 友達申請が届いています</p>
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

    <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
    <FriendApproveModal 
      :isOpen="isApproveModalOpen" 
      :requestUser="selectedRequestUser" 
      @close="isApproveModalOpen = false" 
      @approve="handleApproveDone" 
    />

        <div class="list-header-row">
          <h2 class="list-title">友達リスト</h2>
        </div>

        <div class="control-panel">
          <select v-model="currentFilter" class="custom-select">
            <option value="all">すべて表示</option>
            <option value="friend_only">フレンドのみ</option> <option value="trading">取引中</option>
            <option value="not_friend">取引あり（未フレンド）</option>
          </select>
          <select v-model="currentSort" class="custom-select">
            <option value="added_desc">追加順</option>
            <option value="kana_asc">あいうえお順</option>
            <option value="trade_desc">取引多い順</option>
          </select>
        </div>
      </div>
      
      <div class="friend-scroll-area">
        <FriendCard 
          v-for="user in processedList" 
          :key="user.id" 
          :user="user" 
          @click="navigateToDetail(user)" 
        />
        <p v-if="processedList.length === 0" class="empty-msg">該当するユーザーがいません。</p>
      </div>
    </main>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'; // 🌟 reactiveを追加
import { useRouter } from 'vue-router'

import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { 
  collection,  query,  where,  onSnapshot, 
  doc,  getDoc,  setDoc,  deleteDoc, addDoc,  serverTimestamp 
} from 'firebase/firestore'

import FriendAddModal from '@/components/FriendAddModal.vue'
import FriendCard from '@/components/FriendCard.vue' 
import FriendApproveModal from '@/components/FriendApproveModal.vue' 
import BaseModal from '@/components/BaseModal.vue'; // 🌟 追加

const router = useRouter()
const isModalOpen = ref(false)

const currentFilter = ref('all')
const currentSort = ref('added_desc')

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
      )
      onSnapshot(qReq, (snapshot) => {
        pendingRequests.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            formPhoto: data.formPhoto || data.photo || data.photoURL || "" 
          };
        })
      })

      const qFriends = collection(db, "users", user.uid, "friends")
      onSnapshot(qFriends, (snapshot) => {
        friendData.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            photo: data.photo || data.photoURL || "" 
          };
        })
      })
    }
  })
})

const isApproveModalOpen = ref(false);
const selectedRequestUser = ref(null);

const openApproveModal = (user) => {
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
};

const handleApproveDone = async (request) => {
  // 🌟 alert を美しいモーダルに！
  if (!request.formId) {
    showModal({ type: 'error', title: 'エラー', message: 'この申請データには送信者ID(fromId)が含まれていないため、承認できません。' });
    return;
  }
  
  const myUid = auth.currentUser.uid
  const friendUid = request.formId

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

    const myDoc = await getDoc(doc(db, "users", myUid))
    let myName = "名前なし"
    let myPhoto = "" 
    
    if (myDoc.exists()) {
      const myData = myDoc.data()
      myName = myData.name || "名前なし"
      myPhoto = myData.photo || "" 
    }

    await setDoc(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid,
      name: myName,
      photo: myPhoto || "",
      isFriend: true,
      addedAt: serverTimestamp(),
      tradeCount: 0,
      isTrading: false
    })

    await addDoc(collection(db, "friendRequests"), {
      toId: friendUid,
      formId: myUid,
      formName: myName,
      photo: myPhoto,
      status: "accepted",
      createdAt: serverTimestamp()
    });

    await deleteDoc(doc(db, "friendRequests", request.id))
    
    isApproveModalOpen.value = false
  } catch (error) {
    console.error("承認エラーの詳細:", error)
    // 🌟 alert を美しいモーダルに！
    showModal({ type: 'error', title: '承認エラー', message: '承認に失敗しました。もう一度試すか、相手のデータがあるか確認してください。' });
  }
}

const processedList = computed(() => {
  let list = friendData.value
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
.friend-container { min-height: 100vh; background-color: #eef7ff; }
.content { padding: 20px 20px 100px 20px; box-sizing: border-box; }
.fixed-top-items { margin-bottom: 10px; }

.add-friend-main-button { width: 100%; padding: 12px; background-color: #2169a3; color: white; border: none; border-radius: 25px; font-size: 18px; font-weight: bold; margin-bottom: 25px; cursor: pointer; }
.request-alert { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #ef4444; }
.request-card { background-color: white; display: flex; align-items: center; padding: 10px 20px; border-radius: 40px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.request-avatar-wrapper {
  width: 35px; height: 35px; flex-shrink: 0; margin-right: 15px;
}
.request-avatar-placeholder {
  width: 100%; height: 100%; border-radius: 50%;
}
.request-name { flex: 1; font-size: 18px; font-weight: bold; }
.approve-button { background-color: #ffedb3; border: none; padding: 8px 30px; border-radius: 20px; font-weight: bold; cursor: pointer; }

.list-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.list-title { font-size: 20px; font-weight: bold; margin: 0; }

.control-panel { display: flex; gap: 10px; margin-bottom: 15px; }
.custom-select { flex: 1; padding: 10px; border-radius: 12px; border: 1px solid #cbd5e1; background-color: white; font-size: 12px; font-weight: bold; color: #1e293b; outline: none; }

.friend-scroll-area { display: flex; flex-direction: column; gap: 12px; }
.empty-msg { text-align: center; color: #64748b; font-weight: bold; margin-top: 40px; }

.request-avatar-img {
  width: 100%;  height: 100%;  border-radius: 50%;  object-fit: cover;
}
</style>