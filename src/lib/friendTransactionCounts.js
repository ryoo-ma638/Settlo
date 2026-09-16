// 画面へ渡された元の取引を、相手ごとに数える。保存済みの金額や状態は変更しない。
export function countFriendTransactions(transactions, myUid) {
  const counts = new Map();
  const seen = new Set();
  if (!myUid) return counts;

  for (const transaction of transactions) {
    const { id, paidById, paidToId } = transaction;
    if (!id || seen.has(id) || !paidById || !paidToId || paidById === paidToId) continue;
    const otherUid = paidById === myUid ? paidToId : paidToId === myUid ? paidById : null;
    if (!otherUid) continue;
    seen.add(id);
    counts.set(otherUid, (counts.get(otherUid) || 0) + 1);
  }
  return counts;
}

// 件数は元の明細単位。まとめ申請の逆方向の明細も、確認が済むまでは未精算。
export function summarizeFriendTransactions(transactions, myUid) {
  const summaries = new Map();
  if (!myUid) return summaries;
  const rows = [...new Map(transactions.filter(t => t.id && t.paidById && t.paidToId
    && t.paidById !== t.paidToId && [t.paidById, t.paidToId].includes(myUid))
    .map(t => [t.id, t])).values()];
  const pendingBatches = new Map();
  for (const t of rows) {
    const b = t.settlementBatch;
    if (t.status === 'awaiting_approval' && b?.id && b.role !== 'offset') {
      const other = t.paidById === myUid ? t.paidToId : t.paidById;
      pendingBatches.set(`${other}:${b.id}`, t);
    }
  }
  for (const t of rows) {
    const other = t.paidById === myUid ? t.paidToId : t.paidById;
    const summary = summaries.get(other) || { unsettled: 0, myConfirmation: 0, theirConfirmation: 0 };
    const main = t.settlementBatch?.id && pendingBatches.get(`${other}:${t.settlementBatch.id}`);
    if (t.status !== 'completed' || main) summary.unsettled++;
    if (t.status === 'awaiting_approval' || main) {
      const receiver = main?.paidToId || t.paidToId;
      summary[receiver === myUid ? 'myConfirmation' : 'theirConfirmation']++;
    }
    summaries.set(other, summary);
  }
  return summaries;
}
