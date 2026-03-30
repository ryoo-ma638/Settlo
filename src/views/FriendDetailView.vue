<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // ルート操作用
import { db, auth } from '@/firebase';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';

// 🌟 本来はFirebase等から取得しますが、一旦ダミーデータです
const waitingTotal = ref(3500); // 相手から受け取る分（お支払い待ち）
const unpaidTotal = ref(4800);  // 自分が支払う分（未払い）
//フレンド削除
const route = useRoute();
const router = useRouter();
// 🌟 追加：履歴などで使うための変数を定義
const myPhoto = ref("");
const friendPhoto = ref("");

// 🌟 ここが重要：最初は null にしておき、読み込みを待ちます
const friend = ref(null);

// 🌟 トータル収支（受け取り - 支払い）を計算
const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);

// 🌟 画面が開かれた時にデータを取ってくる処理
// frienddetailview.vue の onMounted 修正案
onMounted(async () => {
  // 🌟 route.query または params の両方から UID を探す
  const uid = route.query.uid || route.params.uid;
  const myUid = auth.currentUser?.uid;
  
  if (!uid || !myUid) {
    console.error("UIDが取得できません。URLを確認してください:", { uid, params: route.params });
    return;
  }

  try {
    // 1. 自分のアイコンを取得
    const myDoc = await getDoc(doc(db, "users", myUid));
    if (myDoc.exists()) {
      myPhoto.value = myDoc.data().photo || myDoc.data().photoURL || "";
    }

    // 2. 相手の「大元のプロフィール」を直接取得（これが確実）
    // 🌟 自分の friends サブコレクションではなく、users 直下を見に行きます
    const userDoc = await getDoc(doc(db, "users", uid));
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      friend.value = data; 
      friendPhoto.value = data.photo || data.photoURL || "";
      console.log("ユーザーデータの取得に成功しました:", data);
    } else {
      // 🌟 ここで「見つからない」と出る場合、Firestore の users/ にその UID の書類がないことになります
      console.error("Firestoreの users コレクションに該当するドキュメントがありません。UID:", uid);
    }
  } catch (error) {
    console.error("データ取得中にエラーが発生しました:", error);
  }
});

//フレンド削除
const handleDeleteFriend = async () => {
  const friendName = route.params.name;
  const friendUid = route.params.uid; // ルーターからUIDを受け取っている想定
  const myUid = auth.currentUser?.uid;

  // デバッグ用：正しく取得できているか確認
console.log("削除対象:", { friendName, friendUid, myUid });

  if (!myUid || !friendUid) {
    alert("ユーザー情報の取得に失敗しました。");
    return;
  }

  // 1. 確認ダイアログを表示
  const confirmDelete = confirm(`${friendName} さんをフレンドから削除しますか？\n(相手のリストからもあなたが削除されます)`);
  
  if (!confirmDelete) return;

  try {
    // 2. 自分のリストから相手を削除
    await deleteDoc(doc(db, "users", myUid, "friends", friendUid));
    
    // 3. 相手のリストから自分を削除 (相互削除)
    await deleteDoc(doc(db, "users", friendUid, "friends", myUid));

    alert(`${friendName} さんを削除しました。`);
    
    // 4. 一覧画面に戻る
    router.push('/friend'); // フレンド一覧のパスに合わせて調整してください
  } catch (error) {
    console.error("削除エラー:", error);
    alert("削除に失敗しました。");
  }
};
</script>
<template>
  <div v-if="friend" class="friend-detail-container">
      <header class="detail-header">
        <button class="back-btn" @click="$router.back()">‹</button>
        
        <div class="user-info-block">
          <div class="main-avatar-wrapper">
            <img v-if="friend.photo" :src="friend.photo" class="main-avatar-img" />
            <div v-else class="default-avatar" :style="{ backgroundColor: friend.color }"></div>
          </div>
          <h1 class="user-name">{{ friend.name }}</h1>
        </div>
        <button class="delete-link-btn" @click="handleDeleteFriend">削除する</button>
      </header>

    <main class="scroll-content">
      <section class="total-balance-card" 
        @click="$router.push({ 
          path: '/combined-settlement/' + $route.params.name, 
          query: { uid: route.params.uid } 
        })"
      >
    <div class="balance-label">トータルの貸し借り</div>
    <div class="balance-main">
      <h2 class="balance-amount" :class="netBalance >= 0 ? 'blue-text' : 'orange-text'">
        {{ netBalance >= 0 ? '受け取る' : '支払う' }} ¥{{ Math.abs(netBalance).toLocaleString() }}
      </h2>
      <span class="arrow-icon">›</span>
    </div>
    <div class="balance-sub-info">
      <div class="sub-item"><span class="dot blue-dot"></span> お支払い待ち: ¥{{ waitingTotal.toLocaleString() }}</div>
      <div class="sub-item"><span class="dot orange-dot"></span> 未払い: ¥{{ unpaidTotal.toLocaleString() }}</div>
    </div>
  </section> 
  <h2 class="section-title">{{ friend.name }} さんとのお支払い状況</h2>

      <section class="status-section">
        <div class="status-header">
          <span class="status-badge blue-badge">お支払い待ち</span>
          <span class="total-amount blue-text">¥0</span>
          <button 
  class="action-btn red-btn pay-all-btn" 
  @click="$router.push('/payment-detail/batch-waiting')"
>
  まとめて催促する
</button>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'w'+n" class="event-card blue-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button 
  class="action-btn red-btn" 
  @click="$router.push('/payment-detail/waiting-' + n)"
>
  催促する
</button></div>
          </div>
        </div>
      </section>
      
      <section class="status-section">
        <div class="status-header">
          <span class="status-badge orange-badge">未払い</span>
          <span class="total-amount orange-text">¥0</span>
          <button 
  class="action-btn green-btn pay-all-btn" 
  @click="$router.push('/payment-detail/all')"
>
  まとめて支払う
</button>
        </div>
        <div class="event-list">
          <div v-for="n in 2" :key="'u'+n" class="event-card orange-card">
            <div class="event-info"><span class="event-date">日付</span><span class="event-name">イベント名</span></div>
            <div class="event-action"><span class="event-amount">¥0</span><button 
  class="action-btn green-btn" 
  @click="$router.push('/payment-detail/unpaid-' + n)"
>
  支払いを完了させる
</button></div>
          </div>
        </div>
      </section>

      <section class="history-section">
        <button class="history-toggle-btn">{{ $route.params.name }} さんとの過去の履歴</button>
        <div class="history-list">
          <div v-for="n in 5" :key="'h'+n" class="history-card">
            <span class="history-event-name">イベント名{{n}}</span>
            <div class="history-flow">
              <div class="avatar history-me">
                <img v-if="myPhoto" :src="myPhoto" class="avatar-img" alt="me" />
                <div v-else class="avatar-placeholder" style="background-color: #d9a0a0;"></div>
              </div>
              <span class="arrow">→</span>
              <div class="avatar history-friend">
                <img v-if="friendPhoto" :src="friendPhoto" class="avatar-img" alt="friend" />
                <div v-else class="avatar-placeholder" style="background-color: #8bb4ff;"></div>
              </div>
            </div>
            <span class="history-amount">¥0</span>
            <span class="check-icon">✅</span>
          </div>
        </div>
      </section>
    </main>
  </div>

  <div v-else class="loading-state">
    <p>読み込み中、またはデータが見つかりません...</p>
  </div>
</template>

<style scoped>
/* 🌟 トータル収支カードのスタイル */
.total-balance-card {
  background-color: #fff;
  border-radius: 25px;
  padding: 20px;
  margin-bottom: 25px;
  box-shadow: 0 4px 15px rgba(33, 105, 163, 0.1);
  cursor: pointer;
  text-align: center;
}
.balance-label { font-size: 12px; color: #64748b; margin-bottom: 8px; }
.balance-main { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; }
.balance-amount { font-size: 32px; font-weight: bold; margin: 0; }
.arrow-icon { font-size: 24px; color: #cbd5e1; }
.balance-sub-info { 
  font-size: 11px; color: #94a3b8; display: flex; justify-content: center; gap: 15px; 
  background: #f8fafc; padding: 8px; border-radius: 12px;
}
.sub-item { display: flex; align-items: center; gap: 5px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.blue-dot { background-color: #3b82f6; }
.orange-dot { background-color: #f59e0b; }

.friend-detail-container { 
  height: calc(100vh - 85px); /* フッター分を引く */
  background-color: #eef7ff; 
  display: flex;
  flex-direction: column;
}

.detail-header { 
  flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; 
  padding: 15px 20px; background-color: #fff; border-radius: 0 0 25px 25px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.scroll-content { flex: 1; overflow-y: auto; padding: 20px; scrollbar-width: none; }
.scroll-content::-webkit-scrollbar { display: none; }

.back-btn { background: none; border: none; font-size: 32px; color: #2169a3; cursor: pointer; }
.user-info-block { display: flex; align-items: center; gap: 10px; }
.user-avatar { width: 45px; height: 45px; border-radius: 50%; }
.user-name { font-size: 20px; font-weight: bold; margin: 0; }
.delete-link-btn { background: none; border: none; color: #ff0000; font-size: 14px; font-weight: bold; }

.section-title { font-size: 20px; font-weight: bold; margin-bottom: 20px; text-align: left; }
.status-section { background-color: #fff; border-radius: 20px; padding: 15px; margin-bottom: 20px; }
.status-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; position: relative; }
.status-badge { padding: 4px 12px; border-radius: 15px; color: white; font-size: 11px; font-weight: bold; }
.blue-badge { background-color: #3b82f6; }
.orange-badge { background-color: #f59e0b; }
.total-amount { font-size: 28px; font-weight: bold; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.pay-all-btn { position: absolute; right: 0; }

.event-list { display: flex; flex-direction: column; gap: 10px; }
.event-card { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-radius: 12px; }
.blue-card { background-color: #e0f2fe; }
.orange-card { background-color: #ffedd5; }
.event-info { display: flex; flex-direction: column; text-align: left; }
.event-date { font-size: 11px; color: #666; }
.event-name { font-size: 15px; font-weight: bold; }
.event-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.event-amount { font-size: 16px; font-weight: bold; }
.action-btn { padding: 5px 12px; border-radius: 20px; border: none; font-size: 11px; font-weight: bold; color: #fff; cursor: pointer; }
.green-btn { background-color: #22c55e; }
.red-btn { background-color: #ef4444; color: #ffffff; }

.history-toggle-btn { width: 100%; padding: 12px; background-color: #93c5fd; color: #fff; border: none; border-radius: 15px; font-size: 18px; font-weight: bold; margin-bottom: 15px; }
.history-card { background-color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 40px; margin-bottom: 10px; }
.history-event-name { font-size: 16px; font-weight: bold; }
.history-flow { display: flex; align-items: center; gap: 8px; }
.avatar { width: 25px; height: 25px; border-radius: 50%; }
.dummy-me { background-color: #d9a0a0; }
.dummy-friend { background-color: #8bb4ff; }
.history-amount { font-size: 18px; font-weight: bold; }
.check-icon { color: #22c55e; }

/* 🌟 画像のスタイル（丸く、小さめに） */
.main-avatar-img {
  width: 50px; /* 🌟 スクリーンショットに合わせたサイズ */  height: 50px;
  border-radius: 50%; /* 正円にする */  object-fit: cover; /* 画像を歪ませずに収める */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* 軽い影をつける */
}

/* 🌟 画像がない場合の予備の丸 */
.default-avatar {
  width: 50px;  height: 50px;  border-radius: 50%;
}

/* 履歴用の追加スタイル */
.avatar {
  width: 32px;  /* 履歴用なので少し小さめに設定 */  height: 32px;  border-radius: 50%;  overflow: hidden; /* 🌟 はみ出し防止 */
  display: flex;  align-items: center;  justify-content: center;  background: #dcdcdc; /* 画像がない時の背景色 */
}

/* 🌟 アイコン画像自体のスタイル（共通） */
.avatar-img {
  width: 100%;  height: 100%;  object-fit: cover; /* 🌟 アスペクト比を維持して埋める */
}

/* 既存のクラスも調整 */
.dummy-me {
  background-color: #ffcccc; /* ピンク */
}
.dummy-friend {
  background-color: #ccccff; /* ブルー */
}

/* CombinedSettlementView.vue の <style scoped> に追加・修正 */

.history-flow {
  display: flex;  align-items: center;  gap: 8px;
}

/* 🌟 アバターの枠のスタイルを共通化・修正 */
.avatar {
  width: 30px;  /* 🌟 履歴用なので、上のカード(50px)より小さく設定 */  height: 30px;  border-radius: 50%;
  overflow: hidden; /* 🌟 はみ出した画像を切る */  display: flex;  align-items: center;
  justify-content: center;  border: 1px solid #e2e8f0; /* 軽い枠線 */
}

/* 🌟 追加：画像自体のスタイル（共通） */
.avatar-img {
  width: 100%;  height: 100%;  object-fit: cover; /* 🌟 縦横比を保って枠を埋める */
}

/* 🌟 画像がない時のプレースホルダー */
.avatar-placeholder {
  width: 100%;  height: 100%;
}

/* ❌ 不要になった dummy クラスを削除、または背景色用に変更 */
.history-me {
  background-color: #d9a0a0; /* 画像がない時の予備色として template で指定 */
}
.history-friend {
  background-color: #8bb4ff;
}
</style>