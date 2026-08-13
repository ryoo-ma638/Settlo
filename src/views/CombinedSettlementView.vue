<template>
    <div class="combined-container">
      <PageHeader title="トータル精算" />
  
      <main class="content">
        <div class="final-card" :class="netBalance >= 0 ? 'receive-bg' : 'pay-bg'">
          <p class="label">{{ netBalance >= 0 ? 'あなたへの未払い（受け取る）' : 'あなたの未払い（支払う）' }}</p>
          <h2 class="amount">¥{{ Math.abs(netBalance).toLocaleString() }}</h2>
          
          <div class="settle-route">
            <div class="avatar-me">
              <img v-if="myPhoto" :src="myPhoto" class="avatar-img" />
              <div v-else class="inline-avatar-default"></div>
            </div>
            <span class="route-arrow">{{ netBalance >= 0 ? '←' : '→' }}</span>
            <div class="avatar-friend">
              <img v-if="friendPhoto" :src="friendPhoto" class="avatar-img" />
              <div v-else class="avatar-placeholder" style="background-color: #ff9980;"></div>
            </div>
          </div>
        </div>
  
        <section class="breakdown-section">
          <div class="section-header">
            <h3 class="section-sub">合算の内訳</h3>
            <button v-if="filterType !== 'all'" class="reset-filter-btn" @click="filterType = 'all'">すべて表示</button>
          </div>
          
          <div class="comparison-row">
            <div class="comp-box blue-border" :class="{ 'active-box': filterType === 'waiting' }" @click="filterType = 'waiting'">
              <span>お支払い待ち</span>
              <strong>¥{{ waitingTotal.toLocaleString() }}</strong>
            </div>
            <div class="comp-operator">ー</div>
            <div class="comp-box orange-border" :class="{ 'active-box': filterType === 'pay' }" @click="filterType = 'pay'">
              <span>未払い</span>
              <strong>¥{{ unpaidTotal.toLocaleString() }}</strong>
            </div>
          </div>
  
          <div class="event-history">
            <p class="history-label">対象のイベント一覧（タップで詳細）</p>
            <div 
              v-for="item in displayedEvents" 
              :key="item.id" 
              class="history-item" 
              :class="{ 'excluded-item': !item.included }"
              @click="openDetailOverlay(item)"
            >
              <button class="toggle-btn" @click.stop="toggleInclude(item)" :aria-label="item.included ? '除外' : '追加'">
                <svg v-if="item.included" viewBox="0 0 24 24"><path d="M6 12h12"/></svg>
                <svg v-else viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>
              </button>
              <div class="item-info">
                <span class="badge" :class="item.type">{{ item.type === 'waiting' ? '受' : '払' }}</span>
                <span class="name">{{ item.eventName }}</span>
              </div>
              <span class="price">¥{{ item.amount.toLocaleString() }}</span>
            </div>
          </div>
        </section>
  
        <footer class="footer-actions">
          <button v-if="netBalance >= 0" class="main-btn blue-btn" :disabled="!hasIncluded" @click="goToActionPage('remind')">
            ¥{{ Math.abs(netBalance).toLocaleString() }} をまとめて催促する
          </button>
          <button v-else class="main-btn orange-btn" :disabled="!hasIncluded" @click="goToActionPage('pay')">
            ¥{{ Math.abs(netBalance).toLocaleString() }} をまとめて支払う
          </button>
        </footer>
      </main>
  
      <Teleport to="body">
        <div v-if="selectedItem" class="overlay" @click.self="selectedItem = null">
          <div class="overlay-content">
            <button class="close-overlay" @click="selectedItem = null" aria-label="閉じる">×</button>
            <PaymentReceipt :item="selectedItem" />
            <button class="main-btn close-btn" @click="selectedItem = null">閉じる</button>
          </div>
        </div>
      </Teleport>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { auth, db } from '@/firebase'; // firebase のインポートを追加
  import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'; // Firestore 用
  import PaymentReceipt from '../components/PaymentReceipt.vue'; // 🌟 コンポーネントをインポート
  import PageHeader from '../components/PageHeader.vue';
  import { showToast } from '@/lib/toast';
  
  const route = useRoute();
  const router = useRouter();

  // 🌟 アイコン保持用の変数
const myPhoto = ref("");
const friendPhoto = ref("");

onMounted(async () => {
  const myUid = auth.currentUser?.uid;
  // 🌟 route.params.uid が正しいかチェック
  const friendUid = route.query.uid;

  if (myUid) {
    // 1. 自分のデータを取得
    const myDoc = await getDoc(doc(db, "users", myUid));
    if (myDoc.exists()) {
      myPhoto.value = myDoc.data().photo || myDoc.data().photoURL || "";
    }

    // 2. 相手（中橋梨心さん）のデータを「users」から直接取る
    if (friendUid) {
      const friendDoc = await getDoc(doc(db, "users", friendUid));
      if (friendDoc.exists()) {
        const data = friendDoc.data();
        // ここで確実に代入
        friendPhoto.value = data.photo || data.photoURL || "";
        console.log("🔥 取得した相手のURL:", friendPhoto.value);
      } else {
        console.error("❌ 相手のユーザーが見つかりません。UID:", friendUid);
      }
    } else {
      console.error("❌ 相手のUIDがURLパラメータに含まれていません");
    }

    // 🌟 この相手との未決済取引を実データから集計してリスト化（複合インデックス回避）
    if (friendUid) {
      const list = [];
      const recvSnap = await getDocs(query(collection(db, "transactions"), where("paidToId", "==", myUid)));
      recvSnap.forEach((d) => {
        const t = d.data();
        if (t.paidById === friendUid && (t.status || 'unpaid') !== 'completed') {
          list.push({ id: d.id, type: 'waiting', eventName: t.itemName || 'イベント代', date: '', name: route.params.name, itemName: t.itemName || '立て替え', amount: t.amount || 0, itemsDetail: t.itemsDetail || [t.itemName], included: true });
        }
      });
      const paySnap = await getDocs(query(collection(db, "transactions"), where("paidById", "==", myUid)));
      paySnap.forEach((d) => {
        const t = d.data();
        if (t.paidToId === friendUid && (t.status || 'unpaid') !== 'completed') {
          list.push({ id: d.id, type: 'pay', eventName: t.itemName || 'イベント代', date: '', name: route.params.name, itemName: t.itemName || '支払い', amount: t.amount || 0, itemsDetail: t.itemsDetail || [t.itemName], included: true });
        }
      });
      allEvents.value = list;
    }
  }
});
  
  // 🌟 実データを onMounted で投入する（初期は空）
  const allEvents = ref([]);
  
  // 🌟 動的計算（included が true のものだけ合算）
  const waitingTotal = computed(() => allEvents.value.filter(e => e.type === 'waiting' && e.included).reduce((sum, e) => sum + e.amount, 0));
  const unpaidTotal = computed(() => allEvents.value.filter(e => e.type === 'pay' && e.included).reduce((sum, e) => sum + e.amount, 0));
  const netBalance = computed(() => waitingTotal.value - unpaidTotal.value);
  // 精算対象（含める取引）が1件でもあるか。無ければ精算ボタンを無効化する
  const hasIncluded = computed(() => allEvents.value.some(e => e.included));
  
  // 🌟 絞り込み機能
  const filterType = ref('all'); // 'all', 'waiting', 'pay'
  const displayedEvents = computed(() => {
    if (filterType.value === 'all') return allEvents.value;
    return allEvents.value.filter(e => e.type === filterType.value);
  });
  
  // 🌟 除外/追加 トグル機能（今回の精算に含めるかを切り替えるだけ・いつでも戻せる）
  const toggleInclude = (item) => {
    item.included = !item.included;
  };
  
  // 詳細表示
  const selectedItem = ref(null);
  const openDetailOverlay = (item) => { selectedItem.value = item; };
  
  // 🌟 相殺専用のアクションページへ遷移
  //    除外を反映するため「今回精算する取引ID（included のみ）」を渡す＝表示と実精算を一致させる
  const goToActionPage = (actionType) => {
    const ids = allEvents.value.filter(e => e.included).map(e => e.id);
    if (ids.length === 0) {
      showToast('精算する取引がありません。除外を見直してください');
      return;
    }
    const q = new URLSearchParams({
      type: actionType,
      amount: String(Math.abs(netBalance.value)),
      uid: route.query.uid || '',
      ids: ids.join(','),
    });
    router.push(`/combined-action/${route.params.name}?${q.toString()}`);
  };
  </script>
  
  <style scoped>
  .combined-container { background: var(--c-bg); width: 100%; box-sizing: border-box; }
  .content { padding: 8px var(--pad) 28px; box-sizing: border-box; }

  .final-card { border-radius: var(--r-lg); padding: 26px; color: white; text-align: center; box-shadow: var(--shadow-card); margin-bottom: 22px; transition: all 0.3s; }
  .receive-bg { background: var(--c-receive); }
  .pay-bg { background: var(--c-pay); }
  .amount { font-size: 44px; font-weight: bold; margin: 15px 0; color: inherit; }
  .settle-route { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 10px; }
  .avatar-me, .avatar-friend { width: 50px; height: 50px; border-radius: 50%; background: #dcdcdc; border: 3px solid white; }
  .route-arrow { font-size: 30px; font-weight: bold; }
  
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .section-sub { font-size: 16px; font-weight: bold; color: var(--c-text); margin: 0; }
  .reset-filter-btn { font-size: 12px; background: var(--c-line-bold); border: none; padding: 4px 10px; border-radius: 12px; cursor: pointer; }
  
  .comparison-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .comp-box { flex: 1; background: white; padding: 15px; border-radius: 15px; display: flex; flex-direction: column; border-bottom: 4px solid; cursor: pointer; transition: 0.2s; opacity: 0.6; }
  .active-box { opacity: 1; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transform: translateY(-2px); }
  .blue-border { border-color: var(--c-receive); }
  .orange-border { border-color: var(--c-pay); }
  .comp-operator { padding: 0 10px; font-weight: bold; color: var(--c-text-faint); }
  
  .event-history { background: white; border-radius: 20px; padding: 20px; }
  .history-label { font-size: 12px; color: var(--c-text-faint); margin-bottom: 10px; }
  .history-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--c-surface-2); cursor: pointer; transition: 0.3s; }
  .excluded-item { opacity: 0.4; text-decoration: line-through; } /* 🌟 除外された項目のスタイル */
  
  .toggle-btn { background: var(--c-surface-2); border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; margin-right: 10px; cursor: pointer; flex-shrink: 0; }
  .toggle-btn svg { width: 15px; height: 15px; fill: none; stroke: var(--c-text-sub); stroke-width: 2.2; stroke-linecap: round; }
  .item-info { display: flex; align-items: center; gap: 10px; flex: 1; }
  .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; color: white; }
  .waiting { background: var(--c-receive); }
  .pay { background: var(--c-pay); }
  .price { font-weight: bold; }
  
  .main-btn { width: 100%; padding: 18px; border-radius: 18px; border: none; font-weight: bold; font-size: 16px; color: white; cursor: pointer; margin-top: 20px; }
  .main-btn:disabled { opacity: 0.45; cursor: default; }
  .blue-btn { background: var(--c-receive); }
  .orange-btn { background: var(--c-pay); }
  .close-btn { background: var(--c-surface-2); color: var(--c-text-sub); }
  
  /* オーバーレイ */
  .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--c-overlay); display: flex; align-items: flex-end; z-index: 3000; }
  .overlay-content { background: var(--c-surface-2); width: 100%; padding: 30px; border-radius: 30px 30px 0 0; position: relative; }
  .close-overlay { position: absolute; top: -40px; right: 20px; font-size: 30px; border: none; background: none; color: white; }

  /* 🌟 戻るボタンのスタイル追加 */
.detail-header {
  display: flex;  align-items: center;  padding: 10px 15px;  background: white;
}
.back-btn {
  background: none;  border: none;  font-size: 32px;  color: var(--c-text-sub);  cursor: pointer;
}

.spacer {
  display: none; /* spacer は padding-right で代用するため非表示 */
}

/* 既存の .avatar-me, .avatar-friend を調整 */
.avatar-me, .avatar-friend {
  width: 50px; height: 50px; border-radius: 50%;   background: #dcdcdc; border: 3px solid white;
  overflow: hidden; /* 🌟 はみ出した画像を切る */  display: flex; align-items: center; justify-content: center;
}

/* 🌟 追加：画像自体のスタイル */
.avatar-img {
  width: 100%; height: 100%;  object-fit: cover; /* 🌟 縦横比を保って枠を埋める */
}

.avatar-placeholder {
  width: 100%; height: 100%;
}
  </style>