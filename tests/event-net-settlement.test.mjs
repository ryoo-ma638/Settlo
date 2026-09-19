import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEventNetSettlement } from '../src/lib/eventNetSettlement.js';

const people = ['A', 'B', 'C', 'D'].map(id => ({ id, name: id }));
const tx = (id, paidById, paidToId, amount, status = 'unpaid') => ({ id, paidById, paidToId, amount, status });

test('A→BとB→CをA→Cの1回へまとめる', () => {
  const plan = buildEventNetSettlement({
    participants: people,
    transactions: [tx('ab', 'A', 'B', 1000), tx('bc', 'B', 'C', 1000)],
  });
  assert.deepEqual(plan.transfers, [{
    id: 'transfer-1', fromId: 'A', toId: 'C', amount: 1000,
    from: 'A', fromPhoto: '', to: 'C', toPhoto: '', roundedToHundred: true,
  }]);
  assert.deepEqual(plan.sourceTransactionIds, ['ab', 'bc']);
});

test('全員の差額を保ったまま支払い回数を減らす', () => {
  const plan = buildEventNetSettlement({
    participants: people,
    transactions: [
      tx('ab', 'A', 'B', 1200),
      tx('ac', 'A', 'C', 800),
      tx('bd', 'B', 'D', 500),
      tx('cd', 'C', 'D', 500),
    ],
  });
  assert.equal(plan.transfers.length, 3);
  const rebuilt = Object.fromEntries(people.map(person => [person.id, 0]));
  for (const row of plan.transfers) {
    rebuilt[row.fromId] -= row.amount;
    rebuilt[row.toId] += row.amount;
  }
  assert.deepEqual(rebuilt, { A: -2000, B: 700, C: 300, D: 1000 });
  assert.equal(plan.nonHundredCount, 0);
});

test('100円で割り切れない残高も1円も捨てず、端数行を最小限にする', () => {
  const plan = buildEventNetSettlement({
    participants: people,
    transactions: [tx('ab', 'A', 'B', 1050), tx('bc', 'B', 'C', 50)],
  });
  assert.equal(plan.transfers.reduce((sum, row) => sum + row.amount, 0), 1050);
  assert.equal(plan.transfers.length, 2);
  assert.equal(plan.nonHundredCount, 1);
  assert.ok(plan.transfers.some(row => row.amount === 1000));
  assert.ok(plan.transfers.some(row => row.amount === 50));
});

test('完了・承認待ち・合成精算行は新しい計算へ重ねない', () => {
  const plan = buildEventNetSettlement({
    participants: people,
    transactions: [
      tx('open', 'A', 'B', 400),
      tx('done', 'A', 'C', 900, 'completed'),
      tx('pending', 'C', 'B', 700, 'awaiting_approval'),
      { ...tx('synthetic', 'B', 'A', 400), syntheticSettlement: true },
    ],
  });
  assert.deepEqual(plan.sourceTransactionIds, ['open']);
  assert.equal(plan.transfers.length, 1);
  assert.equal(plan.transfers[0].amount, 400);
});

test('入力順が変わっても同じ精算結果になる', () => {
  const rows = [tx('1', 'A', 'B', 300), tx('2', 'B', 'C', 500), tx('3', 'C', 'A', 100)];
  const first = buildEventNetSettlement({ participants: people, transactions: rows });
  const second = buildEventNetSettlement({ participants: people, transactions: [...rows].reverse() });
  assert.deepEqual(first.transfers, second.transfers);
});

test('イベント参加者ではない人の取引を名前不明のまま混ぜない', () => {
  assert.throws(() => buildEventNetSettlement({
    participants: people,
    transactions: [tx('outside', 'A', 'X', 500)],
  }), /イベント参加者ではない/);
});

test('13人でも支払い回数が最少の組み合わせを選ぶ', () => {
  const balances = [500, -1000, -1100, 600, -800, -900, -700, -1400, 1900, 1100, 1100, 900, -200];
  const participants = balances.map((_, index) => ({ id: `P${index}`, name: `P${index}` }));
  const debtors = balances.map((amount, index) => ({ index, amount: -amount })).filter(row => row.amount > 0);
  const creditors = balances.map((amount, index) => ({ index, amount })).filter(row => row.amount > 0);
  const transactions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    transactions.push(tx(
      `large-${transactions.length}`,
      participants[debtors[debtorIndex].index].id,
      participants[creditors[creditorIndex].index].id,
      amount,
    ));
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }

  const plan = buildEventNetSettlement({ participants, transactions });
  assert.equal(plan.transfers.length, 9);
});

test('14人以上では100円単位を優先しても支払い回数を増やさない', () => {
  const balances = [-76, -88, -132, -81, 59, -188, 187, 29, -38, 18, 47, 162, 100, 1];
  const participants = balances.map((_, index) => ({ id: `P${index}`, name: `P${index}` }));
  const debtors = balances.map((amount, index) => ({ index, amount: -amount })).filter(row => row.amount > 0);
  const creditors = balances.map((amount, index) => ({ index, amount })).filter(row => row.amount > 0);
  const transactions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    transactions.push(tx(
      `large-fast-${transactions.length}`,
      participants[debtors[debtorIndex].index].id,
      participants[creditors[creditorIndex].index].id,
      amount,
    ));
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }

  const plan = buildEventNetSettlement({ participants, transactions });
  assert.equal(plan.transfers.length, 11);
});

// 別のまとめて精算に予約ずみの取引があるとき、画面とサーバーの答えをそろえる。
// 以前は画面側だけ黙って飛ばしていたため、金額が出るのに始めると失敗した。
test('予約ずみの取引があるときは、画面側でも止める', () => {
  const 予約あり = () => buildEventNetSettlement({
    participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    transactions: [
      { id: 't1', paidById: 'a', paidToId: 'b', amount: 1000, status: 'unpaid' },
      { id: 't2', paidById: 'b', paidToId: 'a', amount: 3000, status: 'unpaid', eventSettlementPlanId: 'plan-x' },
    ],
  });
  assert.throws(予約あり, /別のまとめて精算で使用中/, '予約ずみを飛ばして計算してしまう');
});

test('予約が無ければ、これまでどおり計算できる', () => {
  const r = buildEventNetSettlement({
    participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    transactions: [
      { id: 't1', paidById: 'a', paidToId: 'b', amount: 1000, status: 'unpaid' },
      { id: 't2', paidById: 'b', paidToId: 'a', amount: 3000, status: 'unpaid' },
    ],
  });
  assert.equal(r.transfers.length, 1);
  assert.equal(r.transfers[0].amount, 2000);
});

// 進行中の精算に予約ずみの取引は、追加分の反映で毎回出てくるので止めない。
test('いま動いている精算ぶんの予約は止めない', () => {
  const r = buildEventNetSettlement({
    planId: 'plan-1',
    participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    transactions: [
      { id: 't1', paidById: 'a', paidToId: 'b', amount: 500, status: 'unpaid', eventSettlementPlanId: 'plan-1' },
      { id: 't2', paidById: 'b', paidToId: 'c', amount: 300, status: 'unpaid' },
    ],
  });
  assert.deepEqual(r.sourceTransactionIds, ['t2'], '予約ずみを取り込んでしまう');
  assert.equal(r.transfers.length, 1);
});

test('別の精算の予約は、進行中でも止める', () => {
  assert.throws(() => buildEventNetSettlement({
    planId: 'plan-1',
    participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    transactions: [
      { id: 't1', paidById: 'a', paidToId: 'b', amount: 500, status: 'unpaid', eventSettlementPlanId: 'plan-9' },
    ],
  }), /別のまとめて精算で使用中/);
});
