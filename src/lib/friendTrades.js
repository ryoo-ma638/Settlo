// フレンドの「取引回数」を、実際の transactions から数え直すだけの純粋な計算。
// ここは Firestore に触れない。
//
// ■ なぜ数え直すのか
// 取引回数(tradeCount)は本来、支払いを保存するたびに1件ずつ増える想定だったが、
// その増やす呼び出し自体が無く、増えないまま止まっていた。
// 保存のたびに増やす仕組みを1か所ずつ足すのではなく、正データである transactions
// （このイベントで人ごとに作られる取引）から都度数え直す方式にする。

// 相手UIDごとの取引件数を数える。1件の取引＝自分と相手のどちらかが払う側の記録。
export function countTradesByCounterpart(myUid, transactions = []) {
  const counts = {};
  if (!myUid) return counts;
  const seen = new Set(); // 同じ取引IDを二重に数えない
  for (const t of transactions || []) {
    if (!t || !t.id || seen.has(t.id)) continue;
    seen.add(t.id);
    const other = t.paidById === myUid ? t.paidToId : (t.paidToId === myUid ? t.paidById : null);
    if (!other) continue;
    counts[other] = (counts[other] || 0) + 1;
  }
  return counts;
}
