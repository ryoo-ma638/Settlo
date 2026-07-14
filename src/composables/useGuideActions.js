import { ref, onUnmounted } from 'vue';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

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

  const yen = (v) => `¥${(Number(v) || 0).toLocaleString()}`;

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
    const acts = [];
    const recv = recvList.value;
    const pay = payList.value;
    // ① 相手が支払い済みで、自分の承認待ち（相手を待たせている＝最優先）
    recv.filter((i) => i.status === 'awaiting_approval').forEach((i) => {
      acts.push({ kind: 'approve', text: `${i.name}さんの支払い ${yen(i.amount)} を承認してください`, cta: '承認する', to: `/payment-detail/waiting-${i.id}` });
    });
    // ② 自分の未払い（払う）
    pay.filter((i) => i.status === 'unpaid').forEach((i) => {
      acts.push({ kind: 'pay', text: `${i.name}さんに ${yen(i.amount)} の未払いがあります`, cta: '支払う', to: `/payment-detail/unpaid-${i.id}` });
    });
    // ③ 相手が未払い（催促できる）
    recv.filter((i) => i.status === 'unpaid').forEach((i) => {
      acts.push({ kind: 'remind', text: `${i.name}さんが ${yen(i.amount)} 未払いです`, cta: '催促する', to: `/payment-detail/waiting-${i.id}` });
    });
    actions.value = acts;
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
        return { id: d.id, name: await nameOf(data.paidById), amount: data.amount, status: data.status || 'unpaid' };
      }));
      rebuild();
    }, () => {});

    const qP = query(collection(db, 'transactions'), where('paidById', '==', myUid));
    unsubPay = onSnapshot(qP, async (snap) => {
      const docs = snap.docs.filter((d) => (d.data().status || 'unpaid') !== 'completed' && d.data().paidToId);
      payList.value = await Promise.all(docs.map(async (d) => {
        const data = d.data();
        return { id: d.id, name: await nameOf(data.paidToId), amount: data.amount, status: data.status || 'unpaid' };
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
