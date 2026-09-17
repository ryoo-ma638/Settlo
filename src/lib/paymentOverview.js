import { isEventSettlementReserved } from './eventSettlementGuard.js';

const emptyGroup = () => ({ amount: 0, items: [] });
const emptySide = () => ({ unpaid: emptyGroup(), pending: emptyGroup(), review: emptyGroup() });

// 新しく精算できる取引だけを返す。送金状況を確認中の取引は再送金へ混ぜない。
export function actionablePaymentItems(overview, side) {
  const groups = overview?.[side];
  if (!groups) return [];
  return [...(groups.unpaid?.items || []), ...(groups.pending?.items || [])];
}

const integer = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || !/^\d+$/.test(String(value))) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
};

const sameIds = (expected, actual) => Array.isArray(expected)
  && expected.length === actual.length
  && [...expected].sort().every((id, index) => id === [...actual].sort()[index]);

const add = (overview, side, state, item, issues) => {
  const group = overview[side][state];
  const amount = group.amount + item.amount;
  if (!Number.isSafeInteger(amount)) {
    issues.push({ code: 'amount_total_invalid', id: item.id || null });
    return;
  }
  group.amount = amount;
  group.items.push(item);
};

const issue = (issues, code, row, batchId) => {
  issues.push({ code, id: row?.id || null, ...(batchId ? { batchId } : {}) });
};

// Firestoreには触れず、2つの取引購読を結合した配列から現在の表示用集計だけを作る。
export function buildPaymentOverview(transactions = [], myUid) {
  const overview = { receive: emptySide(), pay: emptySide(), issues: [] };
  const { issues } = overview;
  if (typeof myUid !== 'string' || !myUid) {
    issues.push({ code: 'viewer_uid_missing', id: null });
    return overview;
  }

  const rows = [];
  const seenIds = new Set();
  for (const row of Array.isArray(transactions) ? transactions : []) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !row.id) {
      issue(issues, 'transaction_id_missing', row);
      continue;
    }
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    // イベント全体のまとめて精算に予約された取引は、イベント側だけで操作する。
    // 相手ごとの画面にも出すと、同じ分を二重に精算できてしまう。
    if (isEventSettlementReserved(row)) continue;
    rows.push(row);
  }

  const batchGroups = new Map();
  const malformedBatchRows = new Set();
  for (const row of rows) {
    if (!row.settlementBatch) continue;
    const batchId = row.settlementBatch.id;
    if (typeof batchId !== 'string' || !batchId) {
      issue(issues, 'batch_id_missing', row);
      malformedBatchRows.add(row.id);
      continue;
    }
    if (!batchGroups.has(batchId)) batchGroups.set(batchId, []);
    batchGroups.get(batchId).push(row);
  }

  const handled = new Set(malformedBatchRows);
  for (const [batchId, members] of batchGroups) {
    members.forEach((row) => handled.add(row.id));
    // 完了済みの古いバッチは現在の精算状況に影響しない。旧形式の不足を未精算エラーとして出さない。
    if (members.every((row) => row.status === 'completed')) continue;
    const main = members.filter((row) => (row.settlementBatch.role || 'main') === 'main');
    const batch = main[0]?.settlementBatch;
    const fields = ['id', 'payerUid', 'receiverUid', 'gross', 'offset', 'net', 'count', 'counterCount'];
    const shapeMatches = !!batch && members.every((row) => fields.every((key) => row.settlementBatch?.[key] === batch[key]));
    const gross = integer(batch?.gross);
    const offset = integer(batch?.offset);
    const net = integer(batch?.net);
    const count = integer(batch?.count);
    const counterCount = integer(batch?.counterCount);
    const partiesValid = typeof batch?.payerUid === 'string' && !!batch.payerUid
      && typeof batch?.receiverUid === 'string' && !!batch.receiverUid
      && batch.payerUid !== batch.receiverUid && [batch.payerUid, batch.receiverUid].includes(myUid);
    const counter = members.filter((row) => row.settlementBatch.role === 'offset');
    const rolesValid = members.length === main.length + counter.length;
    const directionsValid = main.every((row) => row.paidById === batch?.payerUid && row.paidToId === batch?.receiverUid)
      && counter.every((row) => row.paidById === batch?.receiverUid && row.paidToId === batch?.payerUid);
    const amounts = new Map(members.map((row) => [row.id, integer(row.amount)]));
    const amountsValid = [...amounts.values()].every((amount) => amount !== null);
    const sum = (list) => list.reduce((total, row) => total + amounts.get(row.id), 0);
    const statesValid = main.every((row) => row.status === 'awaiting_approval')
      && counter.every((row) => row.status === 'completed');
    const idsValid = (!batch?.mainTransactionIds || sameIds(batch.mainTransactionIds, main.map((row) => row.id)))
      && (!batch?.counterTransactionIds || sameIds(batch.counterTransactionIds, counter.map((row) => row.id)));
    const totalsValid = gross !== null && offset !== null && net !== null && count !== null && counterCount !== null
      && gross >= offset && gross - offset === net && count === main.length && counterCount === counter.length
      && amountsValid && sum(main) === gross && sum(counter) === offset;

    if (!shapeMatches || !partiesValid || !rolesValid || !directionsValid || !idsValid || !totalsValid) {
      issue(issues, 'batch_invalid', members[0], batchId);
      continue;
    }
    if (!statesValid) {
      issue(issues, 'inactive_batch_state', members[0], batchId);
      continue;
    }

    const side = batch.payerUid === myUid ? 'pay' : 'receive';
    const opponentUid = side === 'pay' ? batch.receiverUid : batch.payerUid;
    add(overview, side, 'pending', {
      ...main[0], amount: net, opponentUid, batchId, isBatchRow: true,
    }, issues);
  }

  for (const row of rows) {
    if (handled.has(row.id)) continue;
    const { paidById, paidToId } = row;
    if (typeof paidById !== 'string' || !paidById || typeof paidToId !== 'string' || !paidToId) {
      issue(issues, 'party_uid_missing', row);
      continue;
    }
    if (paidById === paidToId) {
      issue(issues, 'self_transaction', row);
      continue;
    }
    if (paidById !== myUid && paidToId !== myUid) {
      issue(issues, 'viewer_not_in_transaction', row);
      continue;
    }
    const amount = integer(row.amount);
    if (amount === null) {
      issue(issues, 'amount_invalid', row);
      continue;
    }
    const status = row.status || 'unpaid';
    if (status === 'completed') continue;
    if (!['unpaid', 'awaiting_approval'].includes(status)) {
      issue(issues, 'status_invalid', row);
      continue;
    }
    const side = paidToId === myUid ? 'receive' : 'pay';
    const opponentUid = side === 'receive' ? paidById : paidToId;
    const state = status === 'awaiting_approval' ? 'pending' : row.approvalReviewRequired ? 'review' : 'unpaid';
    add(overview, side, state, { ...row, amount, opponentUid }, issues);
  }

  return overview;
}
