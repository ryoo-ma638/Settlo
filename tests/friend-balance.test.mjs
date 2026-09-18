import assert from 'node:assert/strict';
import { test } from 'node:test';
import { friendNetFromTransactions } from '../src/lib/friendBalance.js';

const tx = (o) => ({ status: 'unpaid', ...o });

test('受け取る分から支払う分を引いて、人ごとに出す', () => {
  const rows = [
    tx({ id: 'a', paidById: 'x', paidToId: 'me', amount: 2000 }),
    tx({ id: 'b', paidById: 'me', paidToId: 'x', amount: 800 }),
    tx({ id: 'c', paidById: 'me', paidToId: 'y', amount: 500 }),
  ];
  assert.deepEqual(friendNetFromTransactions(rows, 'me'), { x: 1200, y: -500 });
});

test('イベントでまとめて精算中の分は数えない（詳細画面と同じ）', () => {
  // ここを足すと、一覧だけ金額が大きくなって詳細と食い違う
  const rows = [
    tx({ id: 'a', paidById: 'x', paidToId: 'me', amount: 1200 }),
    tx({ id: 'b', paidById: 'x', paidToId: 'me', amount: 1500, eventSettlementPlanId: 'p1' }),
    tx({ id: 'c', paidById: 'x', paidToId: 'me', amount: 2000, eventSettlementPlanId: 'p1' }),
  ];
  assert.deepEqual(friendNetFromTransactions(rows, 'me'), { x: 1200 });
});

test('精算済みは数えない', () => {
  const rows = [
    tx({ id: 'a', paidById: 'x', paidToId: 'me', amount: 1000, status: 'completed' }),
    tx({ id: 'b', paidById: 'x', paidToId: 'me', amount: 300 }),
  ];
  assert.deepEqual(friendNetFromTransactions(rows, 'me'), { x: 300 });
});

test('相手の承認待ちも数える（まだお金は動いていないため）', () => {
  const rows = [tx({ id: 'a', paidById: 'me', paidToId: 'x', amount: 700, status: 'awaiting_approval' })];
  assert.deepEqual(friendNetFromTransactions(rows, 'me'), { x: -700 });
});

test('差し引き0の相手も、0として返す', () => {
  const rows = [
    tx({ id: 'a', paidById: 'x', paidToId: 'me', amount: 1000 }),
    tx({ id: 'b', paidById: 'me', paidToId: 'x', amount: 1000 }),
  ];
  assert.deepEqual(friendNetFromTransactions(rows, 'me'), { x: 0 });
});

test('ログイン前や空でも落ちない', () => {
  assert.deepEqual(friendNetFromTransactions([], 'me'), {});
  assert.deepEqual(friendNetFromTransactions([tx({ id: 'a', paidById: 'x', paidToId: 'me', amount: 1 })], null), {});
});
