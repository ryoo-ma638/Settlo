<template>
  <div class="money-page-container">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1 class="page-title">お支払い・精算</h1>
      <div class="spacer"></div>
    </header>

    <div class="money-content">
      <div class="tab-container">
        <button class="tab-btn" :class="{ active: currentTab === 'waiting' }" @click="currentTab = 'waiting'">入金待ち</button>
        <button class="tab-btn" :class="{ active: currentTab === 'unpaid' }" @click="currentTab = 'unpaid'">未払い</button>
      </div>

      <div v-if="currentTab === 'waiting'" class="tab-content">
        <div class="card summary-card blue-bg">
          <p class="summary-title">現在の入金待ち</p>
          <h1 class="summary-amount">¥ {{ totalReceivable.toLocaleString() }}</h1>
          <div class="badge">△ {{ receivableList.length }}件の入金待ち</div>
        </div>

        <h2 class="section-title">入金待ち詳細</h2>

        <div v-for="item in receivableList" :key="item.id" class="card list-card">
          <div class="list-left">
            <p class="date">{{ item.date }}</p>
            <div class="circle avatar-wrapper">
              <img v-if="item.photo" :src="item.photo" class="avatar-img" />
              <div v-else class="avatar-placeholder" :style="{ backgroundColor: item.color }"></div>
            </div>
            <div class="info">
              <p class="name">{{ item.name }}</p>
              <p class="event">{{ item.itemName }}</p>
            </div>
          </div>
          <div class="list-right">
            <p class="amount red-text">¥{{ item.amount.toLocaleString() }}</p>
            <button class="btn btn-green" @click="$router.push('/payment-detail/waiting-' + item.id)">催促する</button>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'unpaid'" class="tab-content">
        <div class="card summary-card orange-bg">
          <p class="summary-title">現在の未払い</p>
          <h1 class="summary-amount">¥ 8,300</h1>
          <div class="badge">△ 2件の未支払い</div>
        </div>

        <h2 class="section-title">支払い詳細</h2>

        <div v-for="item in payableList" :key="item.id" class="card list-card">
          <div class="list-left">
            <p class="date">{{ item.date }}</p>
            <div class="circle avatar-wrapper">
              <img v-if="item.photo" :src="item.photo" class="avatar-img" />
              <div v-else class="avatar-placeholder" :style="{ backgroundColor: item.color }"></div>
            </div>
            <div class="info">
              <p class="name">{{ item.name }}</p>
              <p class="event">{{ item.itemName }}</p>
            </div>
          </div>
          <div class="list-right">
            <p class="amount red-text">¥{{ item.amount.toLocaleString() }}</p>
            <button class="btn btn-red" @click="$router.push('/payment-detail/unpaid-' + item.id)">支払いを完了させる</button>
          </div>
        </div>
      </div>
      
      <div class="all-history-action">
        <router-link to="/payment-history" class="bg-white border border-gray-200 px-6 py-3 rounded-full shadow-sm text-sm font-bold flex items-center justify-center gap-2 mx-auto w-fit mt-8 active:scale-95 transition-transform">
          📜 全ての履歴を見る
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { db, auth } from '@/firebase' // 🌟 追加
import { onAuthStateChanged } from 'firebase/auth' // 🌟 追加
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore' // 🌟 追加

const route = useRoute()
const currentTab = ref('waiting')

// --- 🌟 ダミーデータを空にして、Firestoreからの読み込み待ちにする ---
const receivableList = ref([]) // 入金待ち（自分が受け取る）
const payableList = ref([])    // 未払い（自分が支払う）

// 🌟 合計金額などを表示するための変数
const totalReceivable = ref(0)
const totalPayable = ref(0)

const saveTransaction = async (selectedFriend, amount, itemName, isMePaying) => {
  try {
    await addDoc(collection(db, "transactions"), {
      itemName: itemName,
      amount: Number(amount),
      // 🌟 条件分岐で入れ替える
      paidById: isMePaying ? auth.currentUser.uid : selectedFriend.uid,
      paidToId: isMePaying ? selectedFriend.uid : auth.currentUser.uid,
      status: "unpaid",
      createdAt: serverTimestamp()
    });
    alert("保存が完了しました！");
  } catch (e) {
    console.error(e);
  }
};

// 🌟 URLパラメータ (?tab=xxx) に応じて開くタブを切り替える
onMounted(() => {
  if (route.query.tab) currentTab.value = route.query.tab
})

onMounted(() => {
  // 1. タブ切り替えロジック（既存）
  if (route.query.tab) {
    currentTab.value = route.query.tab
  }

  // 2. 🌟 ログイン状態を監視してデータを取得
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const myUid = user.uid;

      // ==========================================
      // A. 「入金待ち」（自分が受け取る側）の取得
      // ==========================================
      // 【前提】transactionsコレクションで、paidById != 自分 かつ status == 'unpaid'
      const qReceivable = query(
        collection(db, "transactions"), 
        where("paidToId", "==", myUid), // 自分が受け取る人
        where("status", "==", "unpaid") // まだ未払い
      );

      onSnapshot(qReceivable, async (snapshot) => {
        const list = [];
        let total = 0;
        
        for (const transactionDoc of snapshot.docs) {
          const data = transactionDoc.data();
          total += data.amount || 0;
          
          // 🌟 重要：支払う相手（中橋梨心さんなど）のアイコンと名前を取得
          const otherUid = data.paidById; // 支払う人のID
          let otherName = data.paidByName || "不明なユーザー";
          let otherPhoto = "";
          
          // 相手がFirestoreにユーザー登録していれば、大元から画像を取得
          const userDoc = await getDoc(doc(db, "users", otherUid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            otherName = userData.name || otherName;
            otherPhoto = userData.photo || userData.photoURL || "";
          }

          list.push({
            id: transactionDoc.id,
            date: formatTimestamp(data.createdAt), // 日付フォーマット関数（下に記述）
            name: otherName, // 相手の名前
            itemName: data.itemName || "イベント代",
            amount: data.amount || 0,
            photo: otherPhoto, // 🌟 取得したアイコンURL
            color: data.color || "#93c5fd" // 画像がない時の予備色
          });
        }
        
        receivableList.value = list;
        totalReceivable.value = total;
      });

      // ==========================================
      // B. 「未払い」（自分が支払う側）の取得（省略）
      // 【前提】transactionsコレクションで、paidById == 自分 かつ status == 'unpaid'
      // ここに同様のonSnapshot処理を実装してください
      // ==========================================
// ==========================================
      // B. 🌟「未払い」（自分が支払う側）の取得
      // ==========================================
      const qPayable = query(
        collection(db, "transactions"), 
        where("paidById", "==", myUid), // 🌟 支払う人が「自分」
        where("status", "==", "unpaid") // まだ払っていない
      );

      onSnapshot(qPayable, async (snapshot) => {
        const list = [];
        let total = 0;
        
        for (const transactionDoc of snapshot.docs) {
          const data = transactionDoc.data();
          total += data.amount || 0;
          
          // 🌟 相手（受け取る人 = paidToId）の情報を取得
          const otherUid = data.paidToId; 
          let otherName = data.paidToName || "不明なユーザー";
          let otherPhoto = "";
          
          const userDoc = await getDoc(doc(db, "users", otherUid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            otherName = userData.name || otherName;
            otherPhoto = userData.photo || userData.photoURL || "";
          }

          list.push({
            id: transactionDoc.id,
            date: formatTimestamp(data.createdAt),
            name: otherName,
            itemName: data.itemName || "イベント代",
            amount: data.amount || 0,
            photo: otherPhoto,
            color: data.color || "#fca5a5" // 未払いは赤系の予備色
          });
        }
        
        payableList.value = list;
        totalPayable.value = total; // 🌟 合計金額を更新
      });


    } else {
      console.log("ログインしていません");
      // 必要ならログイン画面へリダイレクト
    }
  });
})

// タブを切り替えずにパラメーターだけ変わった時にも対応
watch(() => route.query.tab, (newTab) => {
  if (newTab) currentTab.value = newTab
})

/*
// --- ダミーデータ ---
const payableList = ref([
  { id: 1, date: '3/10', name: '小野木涼平', itemName: 'レンタカー代', amount: 2000, color: '#fca5a5' },
  { id: 2, date: '3/11', name: '大崎稜馬', itemName: '飲み会代', amount: 6300, color: '#93c5fd' },
])

const receivableList = ref([
  { id: 1, date: '3/12', name: '天野椋祐', itemName: 'カフェ代', amount: 800, color: '#93c5fd' },
  { id: 2, date: '3/14', name: '中橋楓華', itemName: 'ランチ代', amount: 1200, color: '#bbf7d0' },
  { id: 3, date: '3/15', name: '松岡暖來', itemName: 'タクシー代', amount: 1500, color: '#f9a8d4' },
])
  */
// 🌟 補助関数：FirestoreのTimestampを「3/12」形式に変換
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

</script>

<style scoped>
/* 🌟 レイアウトの調整 */
.money-page-container { font-family: 'Noto Sans JP', sans-serif; background-color: #f0f4f8; min-height: 100vh; display: flex; flex-direction: column; }
.money-content { padding: 15px 20px 100px; flex: 1; } /* 🌟 コンテンツ側の余白を設定 */

/* 🌟 ヘッダーのスタイルを追加 */
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px 0; background: transparent; position: sticky; top: 0; z-index: 100; }
.back-btn { background: none; border: none; font-size: 36px; color: #64748b; cursor: pointer; padding: 0; line-height: 1; display: flex; align-items: center; z-index: 101; }
.page-title { position: absolute; left: 50%; transform: translateX(-50%); font-size: 18px; font-weight: 900; margin: 0; color: #1e293b; white-space: nowrap; }
.spacer { width: 36px; }

.tab-container { display: flex; background-color: #e2e8f0; border-radius: 8px; padding: 4px; margin-bottom: 20px; }
.tab-btn { flex: 1; padding: 10px; border: none; background: transparent; font-weight: bold; color: #64748b; border-radius: 6px; cursor: pointer; transition: all 0.3s ease; }
.tab-btn.active { background-color: #fff; color: #0f172a; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }

.card { background-color: #fff; border-radius: 16px; padding: 20px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02); }
.summary-card { text-align: left; }
.blue-bg { background-color: #2563eb; color: #fff; }
.orange-bg { background-color: #f59e0b; color: #fff; }

.summary-title { margin: 0; font-size: 14px; opacity: 0.9; }
.summary-amount { margin: 10px 0; font-size: 36px; font-weight: bold; }
.badge { display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; }

.section-title { font-size: 18px; font-weight: bold; margin: 25px 0 15px 0; color: #1e293b; }

.list-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; }
.list-left { display: flex; align-items: center; gap: 15px; }
.date { font-size: 14px; font-weight: bold; color: #000; margin: 0; }
.circle { width: 30px; height: 30px; border-radius: 50%; }
.info p { margin: 0; }
.name { font-size: 12px; font-weight: bold; color: #000; }
.event { font-size: 10px; color: #64748b; }
.list-right { text-align: center; }
.amount { margin: 0 0 5px 0; font-size: 16px; font-weight: bold; }
.red-text { color: #b91c1c; }

.btn { padding: 6px 16px; border-radius: 20px; border: none; font-size: 12px; font-weight: bold; color: #fff; cursor: pointer; }
.btn-red { background-color: #ef4444; }
.btn-green { background-color: #4ade80; }

.all-history-action { margin-top: 30px; text-align: center; padding-bottom: 20px; }
.all-history-btn { background-color: white; border: 1px solid #cbd5e1; color: #1e293b; padding: 14px 30px; border-radius: 25px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
.all-history-btn:active { background-color: #f8fafc; transform: scale(0.95); }

/* moneypage.vue の <style scoped> に追加・修正 */

.list-left { display: flex; align-items: center; gap: 10px; } /* gapを少し調整 */

/* 🌟 アバター枠のスタイルを追加 */
.circle.avatar-wrapper {
  width: 35px; /* 元の30pxから少し大きく */  height: 35px;  border-radius: 50%;
  overflow: hidden; /* はみ出し防止 */  display: flex;  align-items: center;
  justify-content: center;  box-shadow: 0 2px 4px rgba(0,0,0,0.05); /* 軽い影 */
}

/* 🌟 追加：画像自体のスタイル（共通） */
.avatar-img {
  width: 100%;  height: 100%;  object-fit: cover; /* 🌟 アスペクト比を維持して埋める */
}

/* 🌟 追加：画像がない時のプレースホルダー */
.avatar-placeholder {
  width: 100%;  height: 100%;
}

/* 元の .circle クラスは不要なら削除、または.avatar-placeholderへ継承 */
</style>