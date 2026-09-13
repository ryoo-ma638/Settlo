// 精算の計算だけを取り出して確かめるテスト（Firebase もブラウザも使わない）。
//   実行: npm test   （node tests/settlement.test.mjs）
//
// 確かめること
//   1. 人ごとの精算状況（誰の分が済んでいるか）が取引の状態どおりに出る
//   2. 3人の立て替えで 0人 / 1人 / 2人 が精算済みの各段階で、
//      精算サマリーに出る人と金額が期待どおりになる
//   3. 精算サマリーの金額と、未精算の残り・進捗の数字が食い違わない
//   4. 相殺（両方向の貸し借り）と、承認待ち（申請中）の扱い

import assert from 'node:assert/strict';
import {
  decorateHistory, settlementProgressOf, outstandingTotalOf, plainShares,
} from '../src/lib/eventStatus.js';
import { buildSettlementSummary } from '../src/lib/settlementSummary.js';

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ---- 共通のデータ（A＝自分・B・C の3人イベント） ----
const A = 'uid-a', B = 'uid-b', C = 'uid-c';
const participants = [
  { id: A, name: 'あかり' },
  { id: B, name: 'ばんり' },
  { id: C, name: 'ちさと' },
];

// A が ¥3,000 立て替え、3人で¥1,000ずつ
const baseHistory = {
  id: 'h1',
  payer: 'あかり',
  payerUid: A,
  itemName: '焼肉',
  splitType: 'all',
  amount: 3000,
  status: 'unpaid',
  transactionIds: ['tx-b', 'tx-c'],
  shares: [
    { uid: A, name: 'あかり', amount: 1000 },
    { uid: B, name: 'ばんり', amount: 1000 },
    { uid: C, name: 'ちさと', amount: 1000 },
  ],
};

const txMap = (statusB, statusC) => ({
  'tx-b': { status: statusB, paidById: B, paidToId: A },
  'tx-c': { status: statusC, paidById: C, paidToId: A },
});

// イベント詳細と同じ順で計算する（取引 → 履歴の装飾 → 精算サマリー）
const build = (statusB, statusC, myUid = A) => {
  const history = [decorateHistory(baseHistory, txMap(statusB, statusC))];
  const summary = buildSettlementSummary({ participants, history, myUid });
  return { history, summary, unpaid: summary.filter((s) => s.status === 'unpaid') };
};
const row = (list, from, to) => list.find((s) => s.from === from && s.to === to);

// ---- 1. 誰も精算していない ----
test('0人精算済み：BとCの2人が未払いで残る', () => {
  const { history, unpaid } = build('unpaid', 'unpaid');
  assert.equal(history[0].status, 'unpaid');
  assert.equal(history[0].settledCount, 0);
  assert.equal(history[0].shareCount, 2);
  assert.equal(history[0].outstanding, 2000);
  assert.equal(unpaid.length, 2);
  assert.equal(row(unpaid, 'ばんり', 'あかり').amount, 1000);
  assert.equal(row(unpaid, 'ちさと', 'あかり').amount, 1000);
  // 立替者Aの取り分（¥1,000）は誰にも払わないので債務にしない
  assert.equal(outstandingTotalOf(history), 2000);
  assert.deepEqual(settlementProgressOf(history), { done: 0, total: 2, percent: 0 });
});

// ---- 2. 1人だけ精算（今回の不具合の再現） ----
test('1人精算済み：Bは消え、Cだけが残る', () => {
  const { history, summary, unpaid } = build('completed', 'unpaid');
  // 立て替えとしてはまだ完了していない
  assert.equal(history[0].status, 'unpaid');
  assert.equal(history[0].settledCount, 1);
  assert.equal(history[0].outstanding, 1000);
  // 精算サマリーの未払いに残るのはCだけ（以前はBも残り、押すと対象が無かった）
  assert.equal(unpaid.length, 1);
  assert.equal(row(unpaid, 'ちさと', 'あかり').amount, 1000);
  assert.equal(row(unpaid, 'ばんり', 'あかり'), undefined);
  // 済んだBは「精算済み」側に出る
  const done = summary.filter((s) => s.status === 'completed');
  assert.equal(done.length, 1);
  assert.equal(row(done, 'ばんり', 'あかり').amount, 1000);
  // 画面の数字が食い違わない：未精算の残り＝サマリーの未払い合計
  const unpaidSum = unpaid.reduce((s, r) => s + r.amount, 0);
  assert.equal(outstandingTotalOf(history), unpaidSum);
  assert.deepEqual(settlementProgressOf(history), { done: 1, total: 2, percent: 50 });
});

// ---- 3. 全員精算 ----
test('全員精算済み：未払いが消えて立て替えも完了になる', () => {
  const { history, unpaid } = build('completed', 'completed');
  assert.equal(history[0].status, 'completed');
  assert.equal(history[0].outstanding, 0);
  assert.equal(unpaid.length, 0);
  assert.equal(outstandingTotalOf(history), 0);
  assert.deepEqual(settlementProgressOf(history), { done: 2, total: 2, percent: 100 });
});

// ---- 4. 承認待ち（申請中）は未払い側に残す ----
test('承認待ちは未払いとして残り、申請中の印がつく', () => {
  const { history, unpaid } = build('awaiting_approval', 'unpaid');
  assert.equal(history[0].status, 'unpaid');
  assert.equal(history[0].settledCount, 0); // まだ完了していない
  assert.equal(history[0].outstanding, 2000);
  assert.equal(unpaid.length, 2);
  assert.equal(row(unpaid, 'ばんり', 'あかり').pending, true);
  assert.equal(row(unpaid, 'ちさと', 'あかり').pending, false);
});

// ---- 5. 色分け（自分から見た向き） ----
test('金額の向き：受け取る／支払う／他人同士を区別できる', () => {
  // 自分＝A（立替者）から見る
  const asA = build('unpaid', 'unpaid', A).unpaid;
  assert.equal(row(asA, 'ばんり', 'あかり').involvesMe, true);
  assert.equal(row(asA, 'ばんり', 'あかり').isMePayer, false); // 受け取る
  assert.equal(row(asA, 'ばんり', 'あかり').isOthers, false);
  // 自分＝B（払う側）から見る
  const asB = build('unpaid', 'unpaid', B).unpaid;
  assert.equal(row(asB, 'ばんり', 'あかり').isMePayer, true);  // 支払う
  assert.equal(row(asB, 'ばんり', 'あかり').isOthers, false);
  // B から見た「C → A」は他人同士
  assert.equal(row(asB, 'ちさと', 'あかり').involvesMe, false);
  assert.equal(row(asB, 'ちさと', 'あかり').isOthers, true);
});

// ---- 6. 両方向の貸し借りは相殺される（従来どおり） ----
test('逆方向の立て替えがあると差し引きで1行になる', () => {
  const h2 = {
    id: 'h2', payer: 'ばんり', payerUid: B, itemName: 'タクシー',
    splitType: 'all', amount: 900, status: 'unpaid',
    transactionIds: ['tx-a2', 'tx-c2'],
    shares: [
      { uid: A, name: 'あかり', amount: 300 },
      { uid: B, name: 'ばんり', amount: 300 },
      { uid: C, name: 'ちさと', amount: 300 },
    ],
  };
  const history = [
    decorateHistory(baseHistory, txMap('unpaid', 'unpaid')),
    decorateHistory(h2, {
      'tx-a2': { status: 'unpaid', paidById: A, paidToId: B },
      'tx-c2': { status: 'unpaid', paidById: C, paidToId: B },
    }),
  ];
  const unpaid = buildSettlementSummary({ participants, history, myUid: A })
    .filter((s) => s.status === 'unpaid');
  // B→A ¥1,000 と A→B ¥300 が相殺され、B→A ¥700 の1行になる
  assert.equal(row(unpaid, 'ばんり', 'あかり').amount, 700);
  assert.equal(row(unpaid, 'あかり', 'ばんり'), undefined);
  // 自分が関係しない C → B は、他人同士としてそのまま残る
  assert.equal(row(unpaid, 'ちさと', 'ばんり').amount, 300);
  assert.equal(row(unpaid, 'ちさと', 'ばんり').isOthers, true);
});

// ---- 7. 取引をまだ読めていない間は、保存済みの状態を使う ----
test('取引が未取得のときは履歴の状態のまま出す（ちらつき防止）', () => {
  const h = decorateHistory(baseHistory, {}, { loaded: false });
  assert.equal(h.status, 'unpaid');
  assert.equal(h.outstanding, 2000);
  const done = decorateHistory({ ...baseHistory, status: 'completed' }, {}, { loaded: false });
  assert.equal(done.status, 'completed');
  assert.equal(done.outstanding, 0);
});

// ---- 8. 古いデータ（shares 無し）は従来どおり ----
test('shares が無い古い履歴でも均等割りで計算できる', () => {
  const old = {
    id: 'h0', payer: 'あかり', payerUid: A, itemName: '古い記録',
    splitType: 'all', amount: 3000, status: 'unpaid',
    transactionIds: ['tx-x'], shares: [],
  };
  const history = [decorateHistory(old, { 'tx-x': { status: 'unpaid', paidById: B, paidToId: A } })];
  assert.equal(history[0].status, 'unpaid');
  const unpaid = buildSettlementSummary({ participants, history, myUid: A })
    .filter((s) => s.status === 'unpaid');
  assert.equal(unpaid.length, 2);
  assert.equal(row(unpaid, 'ばんり', 'あかり').amount, 1000);
});

// ---- 9. 保存用に計算結果を落とせる ----
test('ゴミ箱の控えには計算結果を持ち込まない', () => {
  const h = decorateHistory(baseHistory, txMap('completed', 'unpaid'));
  assert.equal(h.shares[1].status, 'completed');
  assert.deepEqual(plainShares(h.shares), [
    { uid: A, name: 'あかり', amount: 1000 },
    { uid: B, name: 'ばんり', amount: 1000 },
    { uid: C, name: 'ちさと', amount: 1000 },
  ]);
});

for (const [name, fn] of cases) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  NG  ${name}`);
    console.error(`      ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${cases.length} 件 合格`);
