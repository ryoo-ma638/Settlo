<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="close">
      <div class="add-modal">
        
        <div v-if="!selectedUser">
          <div class="tab-container">
            <button class="tab-btn" :class="{ active: searchMode === 'name' }" @click="searchMode = 'name'">名前検索</button>
            <button class="tab-btn" :class="{ active: searchMode === 'id' }" @click="searchMode = 'id'">ID検索</button>
          </div>

          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input v-model="searchQuery" type="text" :placeholder="searchMode === 'name' ? '名前を入力' : 'IDを入力'" class="search-input" />
          </div>

          <div class="result-scroll-area">
            <div v-for="user in searchResults" :key="user.uid" class="result-card">
              <div class="user-avatar" :style="{ backgroundColor: user.color || '#cbd5e1' }"></div>
              <span class="user-name">{{ user.name }}</span>
              <button class="add-btn" @click="selectedUser = user">追加</button>
            </div>
          </div>
          <div v-if="searchQuery && searchResults.length === 0" class="empty-msg">
            ユーザーが見つかりません
          </div>

          <button class="close-modal-btn" @click="close">閉じる</button>
        </div>

        <div v-else class="confirm-view">
          <h2 class="modal-title">フレンド追加</h2>
          
          <div class="target-user">
            <div class="avatar" :style="{ backgroundColor: selectedUser.color || '#cbd5e1' }"></div>
            <h3 class="name">{{ selectedUser.name }}</h3>
          </div>

          <p class="question">このユーザーをフレンドに追加しますか？</p>

          <div class="trade-history">
            <h4 class="history-title">過去の取引履歴</h4>
            <ul class="history-list">
              <li><span class="date">3/11</span> 飲み会代 <strong class="price">¥6,300</strong></li>
              <li><span class="date">2/20</span> タクシー代 <strong class="price">¥1,500</strong></li>
            </ul>
          </div>

          <div class="actions">
            <button class="btn execute-btn" @click="executeRequest">申請を送る</button>
            <button class="btn cancel-btn" @click="selectedUser = null">検索に戻る</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const searchMode = ref('name');
const searchQuery = ref('');
const searchResults = ref([]);

// 🌟 新しく追加した変数：選択されたユーザーを一時保存する
const selectedUser = ref(null);

// 検索を実行する関数 (既存のまま)
const performSearch = async () => {
  const text = searchQuery.value.trim();
  if (text.length === 0) { searchResults.value = []; return; }
  try {
    const usersRef = collection(db, "users");
    let q = searchMode.value === 'name' 
      ? query(usersRef, where("name", "==", text), limit(10))
      : query(usersRef, where("displayId", "==", text), limit(1));
      
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => {
      if (doc.id !== auth.currentUser?.uid) {
        results.push({ uid: doc.id, ...doc.data() });
      }
    });
    searchResults.value = results;
  } catch (error) {
    console.error("検索エラー:", error);
  }
};

watch(searchQuery, () => performSearch());

const close = () => {
  searchQuery.value = '';
  selectedUser.value = null; // 閉じる時は選択状態もリセット
  emit('close');
};

// 🌟 本当に申請を送る関数 (引数を不要にし、selectedUser を使う)
const executeRequest = async () => {
  if (!auth.currentUser) { alert("ログインが必要です。"); return; }
  const targetUser = selectedUser.value;

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
    close(); // 成功したらモーダルを閉じる
  } catch (error) {
    console.error("エラー内容:", error);
    alert("申請に失敗しました。もう一度試してください。");
  }
};
</script>

<style scoped>
/* 既存のCSSと新しい確認画面のCSSを統合 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.5); z-index: 2000; display: flex; justify-content: center; align-items: center; padding: 20px; }
.add-modal { width: 100%; max-width: 350px; background-color: #eef7ff; border-radius: 30px; padding: 25px 20px; display: flex; flex-direction: column; gap: 15px; }
.tab-container { display: flex; background-color: #fff; border-radius: 15px; padding: 3px; margin-bottom: 10px;}
.tab-btn { flex: 1; padding: 10px; border: none; background: none; border-radius: 12px; font-weight: bold; color: #666; cursor: pointer; }
.tab-btn.active { background-color: #ffedb3; color: #333; }
.search-input-wrapper { position: relative; background-color: #fff; border: 1px solid #333; border-radius: 5px; height: 35px; display: flex; align-items: center; margin-bottom: 10px; }
.search-icon { position: absolute; left: 10px; }
.search-input { width: 100%; border: none; background: none; padding-left: 35px; outline: none; }
.result-scroll-area { height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.result-card { background-color: #fff; display: flex; align-items: center; gap: 10px; padding: 8px 15px; border-radius: 30px; }
.user-avatar { width: 35px; height: 35px; border-radius: 50%; }
.user-name { flex: 1; font-weight: bold; text-align: left; }
.add-btn { background-color: #ffedb3; border: none; padding: 6px 20px; border-radius: 15px; font-weight: bold; cursor: pointer; }
.empty-msg { text-align: center; color: #999; margin-top: 20px; }
.close-modal-btn { background-color: #fff; border: none; border-radius: 20px; padding: 10px 40px; font-weight: bold; align-self: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-top: 15px; }

/* 🌟 確認画面用のCSS */
.confirm-view { text-align: center; }
.modal-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #1e293b; }
.target-user { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 20px; }
.avatar { width: 80px; height: 80px; border-radius: 50%; }
.name { font-size: 22px; margin: 0; font-weight: bold; }
.question { font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 20px; }
.trade-history { background: #fff; padding: 15px; border-radius: 15px; text-align: left; margin-bottom: 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
.history-title { font-size: 12px; color: #64748b; margin: 0 0 10px 0; }
.history-list { list-style: none; padding: 0; margin: 0; font-size: 14px; }
.history-list li { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding: 8px 0; }
.history-list li:last-child { border-bottom: none; }
.date { color: #94a3b8; font-size: 12px; }
.actions { display: flex; flex-direction: column; gap: 10px; }
.btn { width: 100%; padding: 15px; border-radius: 15px; font-size: 16px; font-weight: bold; cursor: pointer; border: none; }
.execute-btn { background: #2169a3; color: white; }
.cancel-btn { background: #e2e8f0; color: #64748b; }
</style>