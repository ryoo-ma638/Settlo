import { isEventSettlementReserved } from './eventSettlementGuard.js';

// お支払いアシスタントの「次にやること」を、購読した取引の配列から組み立てる。
// Firestoreに触れない純粋な部分だけをここに置き、購読は composables/useGuideActions.js が持つ。
//
// イベントのまとめて精算に予約ずみの取引は、ホームや「まとめて」と同じく通常の導線から外す。
// 残したままだと、精算を始めたあとも件数と金額が減らず、
// 押しても操作できない決済の詳細へ着いてしまう。
const yen = (v) => `¥${(Number(v) || 0).toLocaleString()}`;

export function buildGuideActions(receiveList = [], payList = []) {
  const recv = (Array.isArray(receiveList) ? receiveList : []).filter((i) => !isEventSettlementReserved(i));
  const pay = (Array.isArray(payList) ? payList : []).filter((i) => !isEventSettlementReserved(i));
  const acts = [];
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
  return acts;
}
