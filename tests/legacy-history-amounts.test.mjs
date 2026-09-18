// shares が無い古い立て替え（旧形式）で、イベント詳細の残額と
// 精算サマリーの金額が食い違わないかを見る。
// 食い違うと「残り0円なのにサマリーに2,000円」のように見え、
// どちらを信じればいいのか分からなくなる。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decorateHistory, outstandingTotalOf, settlementProgressOf } from '../src/lib/eventStatus.js';
import { buildSettlementSummary } from '../src/lib/settlementSummary.js';

// 旧形式：shares を持たず、splitType と participants から割り勘していた頃のデータ
const legacyHistory = {
  id: 'h1',
  payerUid: 'A',
  payer: '太郎',
  amount: 6000,
  itemName: 'レンタカー',
  splitType: 'all',
  status: 'unpaid',
  transactionIds: ['t1', 't2'],
  // shares は無い
};
const participants = [
  { id: 'A', name: '太郎' },
  { id: 'B', name: '花子' },
  { id: 'C', name: '次郎' },
];
const txById = {
  t1: { id: 't1', status: 'unpaid', paidById: 'B', paidToId: 'A', amount: 2000 },
  t2: { id: 't2', status: 'unpaid', paidById: 'C', paidToId: 'A', amount: 2000 },
};

test('旧形式でも、イベント詳細の残額が0円にならない', () => {
  const d = decorateHistory(legacyHistory, txById);
  assert.equal(d.status, 'unpaid');
  assert.equal(d.outstanding, 4000, '未払いの取引2件ぶんが残額になる');
  assert.equal(outstandingTotalOf([d]), 4000);
});

test('旧形式の残額と、精算サマリーの合計が一致する', () => {
  const d = decorateHistory(legacyHistory, txById);
  const summary = buildSettlementSummary({ participants, history: [legacyHistory], myUid: 'A' });
  const open = summary.filter((s) => s.status !== 'completed');
  const summaryTotal = open.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  assert.equal(summaryTotal, 4000, 'サマリーは2,000円×2人');
  assert.equal(d.outstanding, summaryTotal, '残額とサマリーが食い違ってはいけない');
});

test('旧形式でも、1人だけ返したら残りはその人の分だけになる', () => {
  const half = { ...txById, t1: { ...txById.t1, status: 'completed' } };
  const d = decorateHistory(legacyHistory, half);
  assert.equal(d.outstanding, 2000);
  assert.equal(d.status, 'unpaid', 'まだ1人残っている');
});

test('旧形式でも、全員返したら残額は0円で完了になる', () => {
  const done = {
    t1: { ...txById.t1, status: 'completed' },
    t2: { ...txById.t2, status: 'completed' },
  };
  const d = decorateHistory(legacyHistory, done);
  assert.equal(d.outstanding, 0);
  assert.equal(d.status, 'completed');
});

test('旧形式でも、進捗が「0件中0件」にならない', () => {
  const d = decorateHistory(legacyHistory, txById);
  const p = settlementProgressOf([d]);
  assert.equal(p.total, 2, '負担している人は2人');
  assert.equal(p.done, 0);
});

test('shares がある新しい形式の結果は変えない', () => {
  const modern = {
    id: 'h2', payerUid: 'A', amount: 6000, itemName: 'レンタカー',
    status: 'unpaid', transactionIds: ['t1', 't2'],
    shares: [
      { uid: 'A', name: '太郎', amount: 2000 },
      { uid: 'B', name: '花子', amount: 2000 },
      { uid: 'C', name: '次郎', amount: 2000 },
    ],
  };
  const d = decorateHistory(modern, txById);
  assert.equal(d.outstanding, 4000);
  assert.equal(d.shareCount, 2);
});

test('取引がまだ届いていないときは、保存済みの状態のまま', () => {
  const d = decorateHistory(legacyHistory, {}, { loaded: false });
  assert.equal(d.status, 'unpaid');
});
