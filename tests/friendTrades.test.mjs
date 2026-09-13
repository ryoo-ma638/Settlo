// フレンドの取引回数(tradeCount)の数え直しだけを取り出して確かめるテスト
// （Firebase もブラウザも使わない）。
//   実行: npm test   （node tests/friendTrades.test.mjs）
//
// 確かめること
//   1. 自分が受け取る側／支払う側どちらの取引でも、相手UIDごとに数えられる
//   2. 完了・未完了を問わず数える（「一緒に支払いをした回数」なので）
//   3. 同じ取引IDは二重に数えない
//   4. 自分がどちらにも関係しない取引・相手UIDが無い取引は数えない

import assert from 'node:assert/strict';
import { countTradesByCounterpart } from '../src/lib/friendTrades.js';

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

const ME = 'uid-me', B = 'uid-b', C = 'uid-c', OTHER = 'uid-other';

test('相手UIDごとに、受け取り・支払いの両方向をまとめて数える', () => {
  const txs = [
    { id: 't1', paidById: B, paidToId: ME, status: 'unpaid' },   // Bが自分に払う
    { id: 't2', paidById: ME, paidToId: B, status: 'completed' }, // 自分がBに払う
    { id: 't3', paidById: C, paidToId: ME, status: 'awaiting_approval' },
  ];
  const counts = countTradesByCounterpart(ME, txs);
  assert.equal(counts[B], 2);
  assert.equal(counts[C], 1);
});

test('完了・未完了を問わず1件は1件として数える', () => {
  const txs = [
    { id: 't1', paidById: B, paidToId: ME, status: 'completed' },
    { id: 't2', paidById: B, paidToId: ME, status: 'unpaid' },
  ];
  assert.equal(countTradesByCounterpart(ME, txs)[B], 2);
});

test('同じ取引IDは二重に数えない（受取・支払い両方のクエリに混ざっても安全）', () => {
  const txs = [
    { id: 't1', paidById: B, paidToId: ME },
    { id: 't1', paidById: B, paidToId: ME }, // 同じIDが重複して渡ってきた想定
  ];
  assert.equal(countTradesByCounterpart(ME, txs)[B], 1);
});

test('自分が関係しない取引・相手が無い取引は数えない', () => {
  const txs = [
    { id: 't1', paidById: B, paidToId: OTHER }, // 自分が関係しない
    { id: 't2', paidById: ME, paidToId: null }, // 相手UIDが無い不正データ
  ];
  assert.deepEqual(countTradesByCounterpart(ME, txs), {});
});

test('自分のUIDが無ければ何も数えない', () => {
  assert.deepEqual(countTradesByCounterpart(null, [{ id: 't1', paidById: B, paidToId: ME }]), {});
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
