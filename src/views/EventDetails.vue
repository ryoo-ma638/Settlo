<script setup>
// ==========================================
// 🌟 1. 2人の import を綺麗に合体！
// ==========================================
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'; 

import AddPaymentModal from '@/components/AddPaymentModal.vue';
import ReceiptPaymentModal from '@/components/ReceiptPaymentModal.vue';
import InviteModal from '@/components/InviteModal.vue';

// ==========================================
// 🌟 2. サーバー(Friend)と データベース(Main)の道具を合体！
// ==========================================
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { db } from '../firebase'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';

// 🌟 URL操作の道具
const route = useRoute();
const router = useRouter();

const timelineSection = ref(null);
const myName = '大崎 稜馬';

const modals = ref({ participants: false, historyDetail: false, summaryDetail: false, unpaidWarning: false, addPayment: false, invite: false });

const inviteUser = () => { modals.value.invite = true; };
const selectedHistory = ref(null);
const selectedSummary = ref(null);

const eventData = ref({
  name: '鈴○サーキット', date: '2026/03/25', total: 18500,
  participants: [
    { id: 1, name: '大崎 稜馬', color: '#fca5a5', isMe: true },
    { id: 2, name: '小野木 涼平', color: '#93c5fd' },
    { id: 3, name: '天野 椋祐', color: '#86efac' },
    { id: 4, name: '中橋 楓華', color: '#fde047' },
  ],
  history: [] // データベースから取得するので初期値は空でOK
});

const sumFilterScope = ref('all'); 
const sumFilterStatus = ref('unpaid'); 
const histFilterScope = ref('all'); 
const histSort = ref('new'); 

// 🌟 履歴から「誰が誰にいくら払うか」を相殺・合算する頭脳！
const calculatedSummary = computed(() => {
  const myName = '大崎 稜馬';
  const rawDebts = [];
  
  eventData.value.history.forEach(history => {
    let creditor = history.payer;
    
    if (history.splitType === 'all' || history.splitType === '全員で割勘') {
      const amountPerPerson = Math.floor(history.amount / eventData.value.participants.length);
      eventData.value.participants.forEach(p => {
        if (p.name !== creditor) {
          rawDebts.push({
            from: p.name, to: creditor,
            amount: amountPerPerson, itemName: history.itemName, status: history.status
          });
        }
      });
    } 
    else if (history.splitType === 'item' && history.items) {
      history.items.forEach(item => {
        if (item.assignees && item.assignees.length > 0) {
          const itemAmount = Math.floor(item.price / item.assignees.length);
          item.assignees.forEach(assignee => {
            if (assignee !== creditor) {
              rawDebts.push({
                from: assignee, to: creditor,
                amount: itemAmount, itemName: item.name, status: history.status
              });
            }
          });
        }
      });
    }
  });

  const aggregated = [];
  const statuses = ['unpaid', 'completed'];
  
  statuses.forEach(status => {
    const debtsForStatus = rawDebts.filter(d => d.status === status);
    const pairs = {}; 
    
    debtsForStatus.forEach(debt => {
      const personA = debt.from < debt.to ? debt.from : debt.to;
      const personB = debt.from < debt.to ? debt.to : debt.from;
      const key = `${personA}|${personB}`;
      
      if (!pairs[key]) pairs[key] = { netA: 0, details: [] };
      
      if (debt.from === personA) {
        pairs[key].netA -= debt.amount;
      } else {
        pairs[key].netA += debt.amount; 
      }
      pairs[key].details.push(debt); 
    });

    Object.keys(pairs).forEach(key => {
      const [personA, personB] = key.split('|');
      const netA = pairs[key].netA;
      const details = pairs[key].details;
      
      if (netA === 0) return; 
      
      let finalFrom, finalTo, finalAmount;
      if (netA < 0) {
        finalFrom = personA; finalTo = personB; finalAmount = Math.abs(netA);
      } else {
        finalFrom = personB; finalTo = personA; finalAmount = netA;
      }
      
      const fromColor = eventData.value.participants.find(p => p.name === finalFrom)?.color || '#ccc';
      const toColor = eventData.value.participants.find(p => p.name === finalTo)?.color || '#ccc';
      
      aggregated.push({
        id: `${status}-${key}`,
        from: finalFrom, fromColor,
        to: finalTo, toColor,
        amount: finalAmount,
        status: status,
        isMePayer: (finalTo === myName), 
        involvesMe: (finalFrom === myName || finalTo === myName),
        details: details 
      });
    });
  });
  
  return aggregated;
});

const filteredSummary = computed(() => {
  return calculatedSummary.value.filter(s => {
    const scopeMatch = sumFilterScope.value === 'all' || (s.from === myName || s.to === myName);
    const statusMatch = sumFilterStatus.value === 'all' || s.status === sumFilterStatus.value;
    return scopeMatch && statusMatch;
  });
});

const filteredHistory = computed(() => {
  let result = eventData.value.history.filter(h => {
    return histFilterScope.value === 'all' || h.involvesMe || h.payer === myName;
  });
  return result.sort((a, b) => histSort.value === 'new' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
});

const unpaidItems = computed(() => eventData.value.history.filter(h => h.status === 'unpaid'));

const scrollToTimeline = () => timelineSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const openHistoryDetail = (h) => { selectedHistory.value = h; modals.value.historyDetail = true; };
const openSummaryDetail = (s) => { selectedSummary.value = s; modals.value.summaryDetail = true; };

// 🌟 Firestoreのデータを「精算済」に更新する
const markAsCompleted = async (id) => {
  try {
    const eventId = "test-event-1"; 
    const docRef = doc(db, "events", eventId, "history", id);
    await updateDoc(docRef, { status: 'completed' });
    console.log("✅ 決済完了！Firestoreを更新しました");
    modals.value.historyDetail = false; 
  } catch (error) {
    console.error("更新エラー:", error);
    alert("決済の更新に失敗しました。");
  }
};

// 🌟 Firestoreへの保存処理
const addHistory = async (newPayment) => {
  try {
    const eventId = "test-event-1"; 
    const historyRef = collection(db, "events", eventId, "history");

    const docRef = await addDoc(historyRef, {
      payer: newPayment.payer, 
      itemName: newPayment.itemName, 
      splitType: newPayment.splitType,
      amount: newPayment.amount, 
      color: '#fca5a5', 
      date: newPayment.date, 
      time: newPayment.time, 
      status: 'unpaid', 
      involvesMe: true, 
      timestamp: serverTimestamp(), 
      items: newPayment.items || [] 
    });

    console.log("🔥 Firestoreに保存成功！ ID:", docRef.id);
    eventData.value.total += newPayment.amount;
    modals.value.addPayment = false;
    setTimeout(scrollToTimeline, 300);
  } catch (error) {
    console.error("保存エラー:", error);
    alert("支払いの追加に失敗しました。");
  }
};

// ==========================================
// 🌟 3. あなた（Main）のリアルタイム同期処理
// ==========================================
onMounted(() => {
  const eventId = "test-event-1"; 
  const historyRef = collection(db, "events", eventId, "history");
  const q = query(historyRef, orderBy("timestamp", "asc"));

  onSnapshot(q, (snapshot) => {
    const fetchedHistory = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      fetchedHistory.push({
        id: doc.id, 
        payer: data.payer,
        itemName: data.itemName,
        splitType: data.splitType,
        amount: data.amount,
        color: data.color || '#fca5a5',
        date: data.date,
        time: data.time,
        status: data.status,
        involvesMe: data.involvesMe,
        items: data.items || [],
        timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now()
      });
    });

    eventData.value.history = fetchedHistory;
    eventData.value.total = fetchedHistory.reduce((sum, item) => sum + item.amount, 0);
  });
});

const goToBatchPayment = (summary) => {
  modals.value.summaryDetail = false;
  const eventId = eventData.value.id || 1;
  
  if (summary.isMePayer) {
    router.push(`/payment-detail/event-unpaid-${eventId}`);
  } else {
    router.push(`/payment-detail/event-waiting-${eventId}`);
  }
};

const handleEndEvent = () => unpaidItems.value.length > 0 ? modals.value.unpaidWarning = true : router.push('/');
const forceEndEvent = () => { modals.value.unpaidWarning = false; router.push('/'); };

// ==========================================
// 🌟 4. お友達（Friend）のクラウド精算呼び出し処理
// ==========================================
const settlementTransfers = ref([]); 

const fetchSettlement = async () => {
  try {
    console.log("精算計算をリクエスト中...");
    const calcFunc = httpsCallable(functions, 'calculateSettlement');
    const response = await calcFunc({ eventId: route.params.id });
    console.log("🎉 精算結果が返ってきました！", response.data);
    settlementTransfers.value = response.data.transfers;
  } catch (error) {
    console.error("❌ 精算計算エラー:", error);
  }
};

// コンポーネントが読み込まれた時に実行
onMounted(() => {
  if (route.params.id) {
    fetchSettlement();
  }
});
</script>