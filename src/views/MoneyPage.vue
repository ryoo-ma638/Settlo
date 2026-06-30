<template>
  <div class="money">
    <header class="screen-head">
      <h1 class="screen-head__title">お支払い・精算</h1>
    </header>

    <div class="money__body">
      <div class="seg">
        <button class="seg__item" :class="{ 'is-active': currentTab === 'waiting' }" @click="currentTab = 'waiting'">入金待ち</button>
        <button class="seg__item" :class="{ 'is-active': currentTab === 'unpaid' }" @click="currentTab = 'unpaid'">未払い</button>
      </div>

      <!-- 入金待ち -->
      <div v-if="currentTab === 'waiting'">
        <div class="summary summary--receive">
          <p class="summary__label">現在の入金待ち</p>
          <div class="summary__amount tnum">¥{{ totalReceivable.toLocaleString() }}</div>
          <span class="summary__badge">{{ receivableList.length }}件</span>
        </div>

        <!-- 🌟 あなたの承認が必要（相手が支払い済みでリクエスト中） -->
        <template v-if="receivableAwaiting.length">
          <h2 class="money__section money__section--action">承認待ち・あなたの承認が必要（{{ receivableAwaiting.length }}件）</h2>
          <div class="stack">
            <div v-for="item in receivableAwaiting" :key="item.id" class="trow trow--action" @click="$router.push('/payment-detail/waiting-' + item.id)">
              <div class="trow__avatar">
                <img v-if="item.photo" :src="item.photo" />
                <div v-else class="trow__ph" :style="{ backgroundColor: item.color }"></div>
              </div>
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge trow__badge--action">あなたが承認</span></p>
              </div>
              <div class="trow__right">
                <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
                <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            </div>
          </div>
        </template>

        <h2 class="money__section">入金待ち詳細</h2>
        <div class="stack">
          <div v-if="receivableUnpaid.length === 0" class="empty-box">入金待ちはありません</div>
          <div v-for="item in receivableUnpaid" :key="item.id" class="trow" @click="$router.push('/payment-detail/waiting-' + item.id)">
            <div class="trow__avatar">
              <img v-if="item.photo" :src="item.photo" />
              <div v-else class="trow__ph" :style="{ backgroundColor: item.color }"></div>
            </div>
            <div class="trow__info">
              <p class="trow__name">{{ item.name }}</p>
              <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span v-if="item.remindCount" class="trow__badge trow__badge--remind">催促 {{ item.remindCount }}回</span></p>
            </div>
            <div class="trow__right">
              <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
              <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 未払い -->
      <div v-else>
        <div class="summary summary--pay">
          <p class="summary__label">現在の未払い</p>
          <div class="summary__amount tnum">¥{{ totalPayable.toLocaleString() }}</div>
          <span class="summary__badge">{{ payableList.length }}件</span>
        </div>

        <!-- 🌟 リクエスト済み（自分が支払い済み・相手の承認待ち） -->
        <template v-if="payableAwaiting.length">
          <h2 class="money__section">リクエスト済み・相手の承認待ち（{{ payableAwaiting.length }}件）</h2>
          <div class="stack">
            <div v-for="item in payableAwaiting" :key="item.id" class="trow trow--muted" @click="$router.push('/payment-detail/unpaid-' + item.id)">
              <div class="trow__avatar">
                <img v-if="item.photo" :src="item.photo" />
                <div v-else class="trow__ph" :style="{ backgroundColor: item.color }"></div>
              </div>
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge">リクエスト済み</span></p>
              </div>
              <div class="trow__right">
                <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
                <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            </div>
          </div>
        </template>

        <h2 class="money__section">支払い詳細</h2>
        <div class="stack">
          <div v-if="payableUnpaid.length === 0" class="empty-box">未払いはありません</div>
          <div v-for="item in payableUnpaid" :key="item.id" class="trow" @click="$router.push('/payment-detail/unpaid-' + item.id)">
            <div class="trow__avatar">
              <img v-if="item.photo" :src="item.photo" />
              <div v-else class="trow__ph" :style="{ backgroundColor: item.color }"></div>
            </div>
            <div class="trow__info">
              <p class="trow__name">{{ item.name }}</p>
              <p class="trow__sub">{{ item.date }}・{{ item.itemName }}</p>
            </div>
            <div class="trow__right">
              <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
              <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <button class="money__history" @click="$router.push('/payment-history')">すべての履歴を見る</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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

// 🌟 承認待ちと通常分を分けて表示するための算出プロパティ
const receivableAwaiting = computed(() => receivableList.value.filter(i => i.status === 'awaiting_approval'))
const receivableUnpaid = computed(() => receivableList.value.filter(i => i.status !== 'awaiting_approval'))
const payableAwaiting = computed(() => payableList.value.filter(i => i.status === 'awaiting_approval'))
const payableUnpaid = computed(() => payableList.value.filter(i => i.status !== 'awaiting_approval'))

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
      const qReceivable = query(
        collection(db, "transactions"),
        where("paidToId", "==", myUid) // 自分が受け取る人
      );

      onSnapshot(qReceivable, async (snapshot) => {
        const list = [];
        let total = 0;

        for (const transactionDoc of snapshot.docs) {
          const data = transactionDoc.data();
          const s = data.status || 'unpaid';
          if (s === 'completed') continue; // 完了済みは未決済リストに出さない

          const otherUid = data.paidById; // 支払う人のID
          if (!otherUid) continue; // 🛡️ 相手UIDが無い不正データはスキップ（クラッシュ防止）
          total += data.amount || 0;

          let otherName = data.paidByName || "不明なユーザー";
          let otherPhoto = "";
          try {
            const userDoc = await getDoc(doc(db, "users", otherUid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              otherName = userData.name || otherName;
              otherPhoto = userData.photo || userData.photoURL || "";
            }
          } catch (e) { console.error("ユーザー取得失敗:", e); }

          list.push({
            id: transactionDoc.id,
            date: formatTimestamp(data.createdAt),
            name: otherName,
            itemName: data.itemName || "イベント代",
            amount: data.amount || 0,
            photo: otherPhoto,
            color: data.color || "#93c5fd",
            status: s,
            statusLabel: txStatusLabel(s),
            remindCount: data.remindCount || 0
          });
        }

        receivableList.value = list;
        totalReceivable.value = total;
      });

      // ==========================================
      // B. 🌟「未払い」（自分が支払う側）の取得
      // ==========================================
      const qPayable = query(
        collection(db, "transactions"),
        where("paidById", "==", myUid) // 🌟 支払う人が「自分」
      );

      onSnapshot(qPayable, async (snapshot) => {
        const list = [];
        let total = 0;

        for (const transactionDoc of snapshot.docs) {
          const data = transactionDoc.data();
          const s = data.status || 'unpaid';
          if (s === 'completed') continue;

          const otherUid = data.paidToId;
          if (!otherUid) continue; // 🛡️ 相手UIDが無い不正データはスキップ（クラッシュ防止）
          total += data.amount || 0;

          let otherName = data.paidToName || "不明なユーザー";
          let otherPhoto = "";
          try {
            const userDoc = await getDoc(doc(db, "users", otherUid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              otherName = userData.name || otherName;
              otherPhoto = userData.photo || userData.photoURL || "";
            }
          } catch (e) { console.error("ユーザー取得失敗:", e); }

          list.push({
            id: transactionDoc.id,
            date: formatTimestamp(data.createdAt),
            name: otherName,
            itemName: data.itemName || "イベント代",
            amount: data.amount || 0,
            photo: otherPhoto,
            color: data.color || "#fca5a5",
            status: s,
            statusLabel: txStatusLabel(s)
          });
        }

        payableList.value = list;
        totalPayable.value = total;
      });

    } else {
      console.log("ログインしていません");
    }
  });
})

// タブを切り替えずにパラメーターだけ変わった時にも対応
watch(() => route.query.tab, (newTab) => {
  if (newTab) currentTab.value = newTab
})

// 取引ステータスの表示ラベル
const txStatusLabel = (s) => s === 'awaiting_approval' ? '承認待ち' : (s === 'completed' ? '完了' : '未決済');

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
.money__body { padding: 6px var(--pad) 28px; }

/* セグメント */
.seg { margin-bottom: 18px; }

/* サマリー */
.summary {
  border-radius: var(--r-lg);
  padding: 20px;
  color: #fff;
  margin-bottom: 8px;
}
.summary--receive { background: var(--c-receive); }
.summary--pay { background: var(--c-pay); }
.summary__label { font-size: 13px; opacity: 0.92; font-weight: var(--fw-medium); }
.summary__amount {
  font-size: 34px;
  font-weight: var(--fw-black);
  letter-spacing: -0.01em;
  margin: 4px 0 10px;
}
.summary__badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.22);
  padding: 4px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: var(--fw-bold);
}

.money__section {
  font-size: 15px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin: 22px 0 12px;
}
.money__section--action { color: var(--c-brand-strong); }
.trow--action { border: 1.5px solid var(--c-brand); }
.trow--muted { opacity: 0.82; }

/* 取引行 */
.trow {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--c-surface);
  border-radius: var(--r-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.trow:active { transform: scale(0.985); }
.trow__avatar {
  width: 40px; height: 40px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0; background: var(--c-line-bold);
}
.trow__avatar img { width: 100%; height: 100%; object-fit: cover; }
.trow__ph { width: 100%; height: 100%; }
.trow__info { flex: 1; min-width: 0; }
.trow__name {
  font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trow__sub { font-size: 12px; color: var(--c-text-sub); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.trow__badge { background: var(--c-pay-weak); color: var(--c-pay-strong); font-size: 10px; font-weight: var(--fw-bold); padding: 2px 8px; border-radius: var(--r-pill); }
.trow__badge--action { background: var(--c-brand-weak); color: var(--c-brand-strong); }
.trow__badge--remind { background: var(--c-receive-weak, #eaf1ff); color: var(--c-receive); }
.trow__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.trow__amount { font-size: 16px; font-weight: var(--fw-black); color: var(--c-ink); }
.trow__chevron { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.trow__btn {
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
  padding: 6px 14px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: var(--fw-bold);
}
.trow__btn:active { transform: scale(0.95); }
.trow__btn--primary { background: var(--c-brand); color: #fff; }

/* 履歴へ */
.money__history {
  display: block;
  width: fit-content;
  margin: 26px auto 0;
  padding: 12px 24px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  color: var(--c-text);
  font-size: 14px;
  font-weight: var(--fw-bold);
  box-shadow: var(--shadow-sm);
}
.money__history:active { transform: scale(0.97); background: var(--c-surface-2); }
</style>
