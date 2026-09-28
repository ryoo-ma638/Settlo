import { ref, onUnmounted } from 'vue';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { buildGuideActions } from '../lib/guideActions.js';

// お支払いアシスタントの「次にやること」を、どのページからでも同じ内容で組み立てる。
// 自分の取引（受け取る=paidToId / 支払う=paidById）を購読し、優先度順のアクション配列を返す。
export function useGuideActions() {
  const actions = ref([]);
  const recvList = ref([]);
  const payList = ref([]);
  const nameCache = {};
  let unsubRecv = null;
  let unsubPay = null;
  let unsubAuth = null;

  async function nameOf(uid) {
    if (!uid) return '不明';
    if (nameCache[uid]) return nameCache[uid];
    try {
      const s = await getDoc(doc(db, 'users', uid));
      const n = s.exists() ? (s.data().name || '不明') : '不明';
      nameCache[uid] = n;
      return n;
    } catch {
      return '不明';
    }
  }

  function rebuild() {
    actions.value = buildGuideActions(recvList.value, payList.value);
  }

  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubRecv) { unsubRecv(); unsubRecv = null; }
    if (unsubPay) { unsubPay(); unsubPay = null; }
    if (!user) {
      recvList.value = [];
      payList.value = [];
      actions.value = [];
      return;
    }
    const myUid = user.uid;

    const qR = query(collection(db, 'transactions'), where('paidToId', '==', myUid));
    unsubRecv = onSnapshot(qR, async (snap) => {
      // 相手UID(paidById)が無い不正データ・完了済みは除外
      const docs = snap.docs.filter((d) => (d.data().status || 'unpaid') !== 'completed' && d.data().paidById);
      recvList.value = await Promise.all(docs.map(async (d) => {
        const data = d.data();
        // イベントのまとめて精算に予約ずみかどうかを判定できるよう、印をそのまま持たせる。
        return {
          id: d.id,
          name: await nameOf(data.paidById),
          amount: data.amount,
          status: data.status || 'unpaid',
          eventSettlementPlanId: data.eventSettlementPlanId,
        };
      }));
      rebuild();
    }, () => {});

    const qP = query(collection(db, 'transactions'), where('paidById', '==', myUid));
    unsubPay = onSnapshot(qP, async (snap) => {
      const docs = snap.docs.filter((d) => (d.data().status || 'unpaid') !== 'completed' && d.data().paidToId);
      payList.value = await Promise.all(docs.map(async (d) => {
        const data = d.data();
        return {
          id: d.id,
          name: await nameOf(data.paidToId),
          amount: data.amount,
          status: data.status || 'unpaid',
          eventSettlementPlanId: data.eventSettlementPlanId,
        };
      }));
      rebuild();
    }, () => {});
  });

  onUnmounted(() => {
    if (unsubRecv) unsubRecv();
    if (unsubPay) unsubPay();
    if (unsubAuth) unsubAuth();
  });

  return { actions };
}
