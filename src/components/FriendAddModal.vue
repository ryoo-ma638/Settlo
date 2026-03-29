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
              <div class="user-avatar-wrapper-mini">
                <img v-if="user.photo" :src="user.photo" class="user-avatar-img" />
                <div v-else class="user-avatar" :style="{ backgroundColor: user.color || '#cbd5e1' }"></div>
              </div>
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
            <div class="avatar-wrapper-large">
              <img v-if="selectedUser.photo" :src="selectedUser.photo" class="user-avatar-img-large" />
              <div v-else class="avatar" :style="{ backgroundColor: selectedUser.color || '#cbd5e1' }"></div>
            </div>
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
import { doc, getDoc } from 'firebase/firestore'; // getDoc と doc を追加

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const searchMode = ref('name');
const searchQuery = ref('');
const searchResults = ref([]);

// 🌟 新しく追加した変数：選択されたユーザーを一時保存する
const selectedUser = ref(null);

// 検索を実行する関数 (既存のまま)
/*const performSearch = async () => {
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
*/

const performSearch = async () => {
  const text = searchQuery.value.trim();
  if (text.length === 0) { searchResults.value = []; return; }
  
  try {
    const results = [];

    if (searchMode.value === 'name') {
      // --- 名前検索 (既存のロジック) ---
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("name", "==", text), limit(10));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        if (doc.id !== auth.currentUser?.uid) {
          const data = doc.data(); // 🌟 一旦データを変数に入れる
          results.push({
            uid: doc.id,
            name: data.name,
            // 🌟 ここを追加！Firestoreのフィールド名「photo」を取得する
            photo: data.photo || ""
          });
        }
      });
    } else {
      // --- ID検索 (ドキュメントID = UID で検索) ---
      const userDocRef = doc(db, "users", text);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.id !== auth.currentUser?.uid) {
        const data = userSnap.data();
        results.push({ 
          uid: userSnap.id, 
          name: data.name,
          // 🌟 ここを追加！
          photo: data.photo || "" 
        });
      }
    }

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

/*
const executeRequest = async () => {
  if (!auth.currentUser) { alert("ログインが必要です。"); return; }
  const targetUser = selectedUser.value; // 申請相手

  try {
    // 🌟 1. A自分のプロフィール情報を Firestore から取得する
    // A自分のドキュメントIDはauth.currentUser.uid
    const myDocRef = doc(db, "users", auth.currentUser.uid);
    const myDoc = await getDoc(myDocRef);

    // 🌟 2. Firestore から最新の名前とアイコンURLを取得する
    // (存在しない場合に備えて、安全に処理するためのロジック)
    const myName = myDoc.exists() ? (myDoc.data().name || "名前なし") : "名前なし";
    const myPhoto = myDoc.exists() ? (myDoc.data().photoURL || "") : ""; // 🌟 これを追加！自分のアイコンURLを取得

    // Firestore に申請データを追加
    await addDoc(collection(db, "friendRequests"), {
      formId: auth.currentUser.uid, // あなたのID
      formName: myName,              // あなたの名前
      fformPhoto: myData.photoURL || "",          // 🌟 これを追加！あなたのアイコンURLを保存する
      toId: targetUser.uid,          // 相手のID
      toName: targetUser.name,       // 相手の名前
      status: "pending",             // 状態を pending（承認待ち）にする
      createdAt: serverTimestamp()   // 時間を保存
    });
    
    alert(`${targetUser.name}さんにフレンド申請を送りました。`);
    close(); 
  } catch (error) {
    console.error("エラー内容:", error);
    alert("申請に失敗しました。もう一度試してください。");
  }
};
*/

const executeRequest = async () => {
  if (!auth.currentUser) { alert("ログインが必要です。"); return; }
  const targetUser = selectedUser.value; // 申請相手

  try {
    // 🌟 1. 自分のデータを Firestore から取得する
    const myDocRef = doc(db, "users", auth.currentUser.uid);
    const myDoc = await getDoc(myDocRef);

    // 🌟 2. 変数 myData を定義する（ここでエラーが解決します）
    let myName = "名前なし";
    let myPhoto = "";

    if (myDoc.exists()) {
      const myData = myDoc.data();
      myName = myData.name || "名前なし";
      // 🌟 photoURL ではなく photo に変更！
      myPhoto = myData.photo || myData.photoURL || "";
      console.log("自分のphoto:", myPhoto); // 🌟 デバッグ：URLが取得できているか確認
    }

    // 🌟 3. 申請データを保存する (formPhoto を追加)
    await addDoc(collection(db, "friendRequests"), {
      toId: targetUser.uid,
      toName: targetUser.name,
      formId: auth.currentUser.uid,
      formName: myName,
      formPhoto: myPhoto, // 🌟 これで相手に画像URLが届きます
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert("申請を送りました！");
    emit('close');
  } catch (error) {
    console.error("エラー内容:", error);
    alert("申請に失敗しました。");
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

.user-avatar-wrapper-mini { width: 35px; height: 35px; flex-shrink: 0; }
.avatar-wrapper-large { width: 80px; height: 80px; flex-shrink: 0; }
.user-avatar-img, .user-avatar-img-large { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
</style>