import { buildPaymentOverview } from './paymentOverview.js';

// 🌟 フレンド一覧に出す「その人との差し引き」。
//    >0 = その人から受け取る ／ <0 = その人へ支払う。
//
//    フレンド詳細と同じ数にしないと、同じ相手で2つの金額が並んでしまう。
//    詳細側は「イベントでまとめて精算中の分」を balance から外し、
//    相手ごとのまとめ精算は差し引き後の1件として数えている。
//    どちらも buildPaymentOverview が済ませているので、その結果を人ごとに分ける。
//
//    イベントの分をここに入れないのは、あの金額が3人以上の精算を
//    1人に付け替えたものになりうるため。イベントの画面で見せる。
const SIDES = [['receive', 1], ['pay', -1]];
const STATES = ['unpaid', 'pending', 'review'];

export function friendNetByUid(overview) {
  const out = {};
  if (!overview) return out;
  for (const [side, sign] of SIDES) {
    for (const state of STATES) {
      const items = (overview[side] && overview[side][state] && overview[side][state].items) || [];
      for (const item of items) {
        const uid = item.opponentUid;
        if (!uid) continue;
        out[uid] = (out[uid] || 0) + sign * (Number(item.amount) || 0);
      }
    }
  }
  return out;
}

// 取引の配列からそのまま出す入口。画面側はこれだけ呼べばよい。
export function friendNetFromTransactions(transactions, myUid) {
  if (!myUid) return {};
  return friendNetByUid(buildPaymentOverview(transactions, myUid));
}
