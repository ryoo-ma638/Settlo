// イベント内の未精算取引を、参加者全員の差額へまとめる純粋計算。
// Firestoreや画面から切り離し、1円も増減させずに検証できるようにする。

const yen = value => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : 0;
};

const better = (candidate, current) => {
  if (!current) return true;
  if (candidate.length !== current.length) return candidate.length < current.length;
  const odd = rows => rows.filter(row => row.amount % 100 !== 0).length;
  return odd(candidate) < odd(current);
};

const transferFor = (leftId, left, rightId, amount) => left < 0
  ? { fromId: leftId, toId: rightId, amount }
  : { fromId: rightId, toId: leftId, amount };

// 参加者が少ない通常のイベントでは、支払い回数を最優先、
// 次に100円で割り切れない支払いの本数を少なくする。
function exactTransfers(entries) {
  let best = null;
  const seen = new Map();

  const visit = (balances, rows) => {
    const first = balances.findIndex(([, value]) => value !== 0);
    if (first < 0) {
      if (better(rows, best)) best = rows.map(row => ({ ...row }));
      return;
    }
    if (best && rows.length >= best.length) return;
    const key = balances.map(([, value]) => value).join(',');
    const previous = seen.get(key);
    const oddCount = rows.filter(row => row.amount % 100 !== 0).length;
    if (previous && (previous.length < rows.length || (previous.length === rows.length && previous.odd <= oddCount))) return;
    seen.set(key, { length: rows.length, odd: oddCount });

    const [leftId, left] = balances[first];
    const duplicateAmounts = new Set();
    const choices = [];
    for (let i = first + 1; i < balances.length; i += 1) {
      const right = balances[i][1];
      if (!right || Math.sign(right) === Math.sign(left) || duplicateAmounts.has(right)) continue;
      duplicateAmounts.add(right);
      const amount = Math.min(Math.abs(left), Math.abs(right));
      choices.push({ index: i, amount, round: amount % 100 === 0 });
    }
    // 同じ回数なら100円単位を先に試す。
    choices.sort((a, b) => Number(b.round) - Number(a.round) || b.amount - a.amount);
    for (const choice of choices) {
      const next = balances.map(row => [...row]);
      const right = next[choice.index][1];
      next[first][1] += left < 0 ? choice.amount : -choice.amount;
      next[choice.index][1] += right < 0 ? choice.amount : -choice.amount;
      visit(next, [...rows, transferFor(leftId, left, next[choice.index][0], choice.amount)]);
    }
  };

  visit(entries.map(row => [...row]), []);
  return best || [];
}

// 大人数時は処理時間を一定にする。差額の大きい人から組み合わせ、
// 同額候補では100円単位になる組合せを優先する。
function runGreedy(entries, preferHundreds) {
  const debtors = entries.filter(([, value]) => value < 0).map(([id, value]) => ({ id, amount: -value }));
  const creditors = entries.filter(([, value]) => value > 0).map(([id, value]) => ({ id, amount: value }));
  const rows = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount);
    const debtor = debtors[0];
    creditors.sort((a, b) => {
      if (!preferHundreds) return b.amount - a.amount;
      const aAmount = Math.min(debtor.amount, a.amount);
      const bAmount = Math.min(debtor.amount, b.amount);
      return Number(bAmount % 100 === 0) - Number(aAmount % 100 === 0) || b.amount - a.amount;
    });
    const creditor = creditors[0];
    const amount = Math.min(debtor.amount, creditor.amount);
    rows.push({ fromId: debtor.id, toId: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (!debtor.amount) debtors.shift();
    if (!creditor.amount) creditors.shift();
  }
  return rows;
}

function greedyTransfers(entries) {
  const fewerFirst = runGreedy(entries, false);
  const hundredsFirst = runGreedy(entries, true);
  return better(hundredsFirst, fewerFirst) ? hundredsFirst : fewerFirst;
}

export function buildEventNetSettlement({ transactions = [], participants = [] } = {}) {
  const participantById = new Map(participants.map(person => [person.id, person]));
  const balances = new Map(participants.map(person => [person.id, 0]));
  const sourceTransactions = [];

  for (const transaction of transactions) {
    if (!transaction || transaction.syntheticSettlement || transaction.eventSettlementPlanId
      || (transaction.status || 'unpaid') !== 'unpaid') continue;
    const amount = yen(transaction.amount);
    const fromId = transaction.paidById;
    const toId = transaction.paidToId;
    if (!amount || !fromId || !toId || fromId === toId) continue;
    if (!participantById.has(fromId) || !participantById.has(toId)) {
      throw new Error('イベント参加者ではない人を含む取引があります。参加者と明細を確認してください。');
    }
    balances.set(fromId, balances.get(fromId) - amount);
    balances.set(toId, balances.get(toId) + amount);
    sourceTransactions.push({
      id: transaction.id,
      paidById: fromId,
      paidToId: toId,
      amount,
      itemName: transaction.itemName || '',
      historyId: transaction.historyId || null,
    });
  }

  const entries = [...balances.entries()].filter(([, amount]) => amount !== 0).sort(([a], [b]) => String(a).localeCompare(String(b)));
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  if (total !== 0) throw new Error('精算額の合計が一致しません。元の取引を確認してください。');
  // 13人までは全候補を比較し、支払い回数が本当に最少の結果を選ぶ。
  // それ以上は画面が固まらないよう、処理時間が人数に比例する計算へ切り替える。
  const rawTransfers = entries.length <= 13 ? exactTransfers(entries) : greedyTransfers(entries);
  const transfers = rawTransfers.map((row, index) => ({
    id: `transfer-${index + 1}`,
    ...row,
    from: participantById.get(row.fromId)?.name || 'メンバー',
    fromPhoto: participantById.get(row.fromId)?.photo || '',
    to: participantById.get(row.toId)?.name || 'メンバー',
    toPhoto: participantById.get(row.toId)?.photo || '',
    roundedToHundred: row.amount % 100 === 0,
  }));
  return {
    balances: Object.fromEntries(entries),
    transfers,
    sourceTransactions,
    sourceTransactionIds: sourceTransactions.map(row => row.id),
    exactTotal: transfers.reduce((sum, row) => sum + row.amount, 0),
    nonHundredCount: transfers.filter(row => !row.roundedToHundred).length,
  };
}
