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

    <FriendAddModal :isOpen="isModalOpen" @close="isModalOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { auth, db } from '@/firebase' // ★ firebase.js から db と auth を読み込む
import { onAuthStateChanged } from 'firebase/auth' // ★ ログイン状態の監視
import { 
  collection,  query,  where,  onSnapshot, 
  doc,  getDoc,  setDoc,  deleteDoc, addDoc,  serverTimestamp 
} from 'firebase/firestore' // ★ Firestore操作に必要なものすべて

import FriendAddModal from '@/components/FriendAddModal.vue'
import FriendCard from '@/components/FriendCard.vue' // 🌟 追加
// 🌟 <script setup> に追加する処理
import FriendApproveModal from '@/components/FriendApproveModal.vue' // インポートを追加

const router = useRouter()
const isModalOpen = ref(false)

const currentFilter = ref('all')
const currentSort = ref('added_desc')

// 決済保存時などに呼び出す関数
const addTradingUserToList = async (targetUser) => {
  const myUid = auth.currentUser.uid;
  const friendUid = targetUser.uid; // 相手のUID

  const friendRef = doc(db, "users", myUid, "friends", friendUid);
  const friendDoc = await getDoc(friendRef);

  // 🌟 まだリストにいない場合のみ保存（上書き防止）
  if (!friendDoc.exists()) {
    await setDoc(friendRef, {
      uid: friendUid,
      name: targetUser.name,
      photo: targetUser.photo || targetUser.photoURL || "",
      isFriend: false,    // 🌟 ここを false にすることで「未フレンド」扱いにする
      isTrading: true,    // 取引あり
      addedAt: serverTimestamp(),
      tradeCount: 1
    });
  } else {
    // 既にいる場合は取引中フラグだけ更新
    await updateDoc(friendRef, { isTrading: true });
  }
};

const friendData = ref([]);
const pendingRequests = ref([]);
/*
// 🌟 ダミーデータ（テスト用にフィルターがかかるよう情報を追加）
const friendData = ref([
  { id: 1, name: '天野 椋祐', kana: 'アマノ リョウスケ', color: '#ff9980', isFriend: true, isTrading: true, tradeCount: 5, addedAt: '2026-03-20' },
  { id: 2, name: '小野木 涼平', kana: 'オノギ リョウヘイ', color: '#ffee10', isFriend: true, isTrading: false, tradeCount: 12, addedAt: '2025-12-10' },
  { id: 3, name: '大崎 稜馬', kana: 'オオサキ リョウマ', color: '#ff0000', isFriend: false, isTrading: true, tradeCount: 2, addedAt: '' },
  { id: 4, name: '中橋 楓華', kana: 'ナカハシ フウカ', color: '#889900', isFriend: true, isTrading: true, tradeCount: 8, addedAt: '2026-01-15' },
])
// 申請がきているユーザーのダミーデータ
const pendingRequests = ref([
  { id: 101, name: 'テスト 太郎', color: '#a0aec0' }
]);
*/

// Firestoreからデータを読み込む処理
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // 1. 自分宛の申請を監視
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

      // 2. 自分の友達リストを監視
      const qFriends = collection(db, "users", user.uid, "friends")
      onSnapshot(qFriends, (snapshot) => {
        friendData.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // FriendCard内で 'photo' を参照しているなら、ここで photo を確定させる
            photo: data.photo || data.photoURL || "" 
          };
        })
      })
    }
  })
})

// 承認モーダル用の状態管理
const isApproveModalOpen = ref(false);
const selectedRequestUser = ref(null);



// 確認ボタンを押した時
const openApproveModal = (user) => {
  selectedRequestUser.value = user;
  isApproveModalOpen.value = true;
};

// ★ 承認処理（ここが正しく書かれていないとエラーになります）
const handleApproveDone = async (request) => {
  // 安全装置：もし formId がなければ処理を中断する
  if (!request.formId) {
    alert("この申請データには送信者ID(fromId)が含まれていないため、承認できません。");//ここは文字なのでfromにしている
    return;
  }
  
  const myUid = auth.currentUser.uid
  const friendUid = request.formId

  try {
    // 1. 自分の「friends」サブコレクションに相手を追加
    await setDoc(doc(db, "users", myUid, "friends", request.formId), {
      uid: request.formId,
      name: request.formName,
      // 🌟 ここがポイント：申請データからアイコンURLをコピーする
      photo: request.formPhoto || "", 
      isFriend: true,
      isTrading: false,
      tradeCount: 0,
      addedAt: serverTimestamp()
    });

    // 2. 相手側の名前を取得（存在しない場合に備えて安全に処理）
    const myDoc = await getDoc(doc(db, "users", myUid))
    let myName = "名前なし"
    let myPhoto = "" // 🌟 自分のアイコン用
    
    if (myDoc.exists()) {
      const myData = myDoc.data()
      myName = myData.name || "名前なし"
      // 🌟 photoURL ではなく photo に変更！
      myPhoto = myData.photo || "" 
    }

    // 3. 相手のリストに自分を追加
    await setDoc(doc(db, "users", friendUid, "friends", myUid), {
      uid: myUid,
      name: myName,
      photo: myPhoto || "",
      isFriend: true,
      addedAt: serverTimestamp(),
      tradeCount: 0,
      isTrading: false
    })

    // 🌟 3. 相手へ「承認されました」というお知らせを送る
    // friendRequests コレクションに新しいドキュメントを作る
    await addDoc(collection(db, "friendRequests"), {
      toId: friendUid,          // 相手のID
      formId: myUid,            // 自分のID
      formName: myName,         // 自分の名前
      photo: myPhoto, // 🌟 相手のFirestoreに自分の画像URLを書き込む
      status: "accepted",       // 🌟 状態を 'accepted' にする
      createdAt: serverTimestamp()
    });

    // 4. 申請データを削除
    await deleteDoc(doc(db, "friendRequests", request.id))
    

    
    isApproveModalOpen.value = false
  } catch (error) {
    console.error("承認エラーの詳細:", error)
    alert("承認に失敗しました。もう一度試すか、相手のデータがあるか確認してください。")
  }
}

// フィルタ・ソートロジック
const processedList = computed(() => {
  let list = friendData.value
  // 🌟 フィルター条件を拡充
  if (currentFilter.value === 'trading') {
    list = list.filter(u => u.isTrading);
  } else if (currentFilter.value === 'friend_only') {
    list = list.filter(u => u.isFriend === true);
  } else if (currentFilter.value === 'not_friend') {
    // 🌟 修正：取引はあるが、フレンドではない人（isFriend が false または未定義）
    list = list.filter(u => u.isFriend === false || u.isFriend === undefined);
  }
  
  // ソート処理（既存のまま）
  return [...list].sort((a, b) => {
    if (currentSort.value === 'kana_asc') {
      return (a.kana || "").localeCompare(b.kana || "", 'ja');
    }
    // addedAt がない場合（未フレンド時など）を考慮して 0 をデフォルトに
    const timeA = a.addedAt?.seconds || 0;
    const timeB = b.addedAt?.seconds || 0;
    return timeB - timeA;
  });
});

const navigateToDetail = (friend) => {
  // console.log(friend) で中身を確認すると、id または uid という名前でIDが入っているはずです
  const uid = friend.uid || friend.id; 

  if (!uid) {
    console.error("UIDが見つかりません:", friend);
    return;
  }

  // 🌟 pathの末尾にUIDを入れ、さらに query としても UID を渡す
  router.push({
    path: `/friend/${encodeURIComponent(friend.name)}/${uid}`,
    query: { uid: uid } // 🌟 これがないと detail 側の route.query.uid が空になります
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
/* 元の .blue-avatar を変更 */
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