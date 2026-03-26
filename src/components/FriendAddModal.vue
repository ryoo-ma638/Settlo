<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="add-modal">
        
        <div class="tab-container">
          <button 
            class="tab-btn" 
            :class="{ active: searchMode === 'name' }"
            @click="searchMode = 'name'"
          >
            名前検索
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: searchMode === 'id' }"
            @click="searchMode = 'id'"
          >
            ID検索
          </button>
        </div>

        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery" 
            type="text" 
            :placeholder="searchMode === 'name' ? '名前を入力' : 'IDを入力'"
            class="search-input"
          />
        </div>

        <div class="result-scroll-area">
          <div v-for="(user, index) in searchResults" :key="user.uid" class="result-card">
            <div class="user-avatar" :style="{ backgroundColor: user.color }"></div>
            <span class="user-name">{{ user.name }}</span>
            <button class="add-btn" @click="sendFriendRequest(user)">追加</button>
          </div>
        </div>
        <div v-if="searchQuery && searchResults.length === 0" style="text-align: center; color: #999; margin-top: 20px;">
          ユーザーが見つかりません
        </div>

        <button class="close-modal-btn" @click="close">閉じる</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs,limit } from 'firebase/firestore';

defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close']);

const searchMode = ref('name');
const searchQuery = ref('');

const searchResults = ref([]);

// 検索を実行する関数
const performSearch = async () => {
  const text = searchQuery.value.trim();
  if (text.length === 0) {
    searchResults.value = [];
    return;
  }

  try {
    const usersRef = collection(db, "users");
    let q;

    if (searchMode.value === 'name') {
      // 名前で完全一致検索（Firestoreの制限上、部分一致は少し複雑なためまずは完全一致から）
      q = query(usersRef, where("name", "==", text), limit(10));
    } else {
      // IDで検索（usersに displayId フィールドがある前提）
      q = query(usersRef, where("displayId", "==", text), limit(1));
    }

    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      // 自分自身は結果に表示しない
      if (doc.id !== auth.currentUser?.uid) {
        results.push({
          uid: doc.id,
          ...doc.data()
        });
      }
    });
    searchResults.value = results;
  } catch (error) {
    console.error("検索エラー:", error);
  }
};

// 入力されるたびに検索を実行（少し遅延を入れると丁寧ですが、まずはシンプルに）
watch(searchQuery, () => {
  performSearch();
});

const close = () => {
  searchQuery.value = '';
  emit('close');
};

const sendFriendRequest = async (targetUser) => {
  //ログインの確認
  if (!auth.currentUser) {
    alert("ログインが必要です。");
    return;
  }

  if (targetUser.uid === auth.currentUser?.uid) {
    alert("自分自身には申請できません");
    return;
  }

  try {
    await addDoc(collection(db, "friendRequests"), {
      formId: auth.currentUser.uid,
      formName: auth.currentUser.displayName,
      toId: targetUser.uid,
      toName: targetUser.name,
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert(`${targetUser.name}さんにフレンド申請を送りました。`);
  }　catch (error){
    console.error("エラー内容:", error);
    alert("申請に失敗しました。もう一度試してください。")
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000; display: flex; justify-content: center; align-items: center; padding: 20px;
}
.add-modal {
  width: 100%; max-width: 350px; background-color: #eef7ff;
  border-radius: 30px; padding: 25px 20px; display: flex; flex-direction: column; gap: 15px;
}
.tab-container { display: flex; background-color: #fff; border-radius: 15px; padding: 3px; }
.tab-btn { flex: 1; padding: 10px; border: none; background: none; border-radius: 12px; font-weight: bold; color: #666; cursor: pointer; }
.tab-btn.active { background-color: #ffedb3; color: #333; }

.search-input-wrapper { position: relative; background-color: #fff; border: 1px solid #333; border-radius: 5px; height: 35px; display: flex; align-items: center; }
.search-icon { position: absolute; left: 10px; }
.search-input { width: 100%; border: none; background: none; padding-left: 35px; outline: none; }

.result-scroll-area { height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.result-card { background-color: #fff; display: flex; align-items: center; gap: 10px; padding: 8px 15px; border-radius: 30px; }
.user-avatar { width: 35px; height: 35px; border-radius: 50%; }
.user-name { flex: 1; font-weight: bold; text-align: left; }
.add-btn { background-color: #ffedb3; border: none; padding: 6px 20px; border-radius: 15px; font-weight: bold; cursor: pointer; }

.close-modal-btn { background-color: #fff; border: none; border-radius: 20px; padding: 10px 40px; font-weight: bold; align-self: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
</style>