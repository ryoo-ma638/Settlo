// イベント一覧の並び替え・振り分けだけを取り出して確かめるテスト（Firebase もブラウザも使わない）。
//   実行: npm test   （node tests/eventList.test.mjs）
//
// 確かめること
//   1. 終了済み(ended)が進行中から外れ、両方が別枠で取り出せる
//   2. 並び順は「最後にお支払いが動いた順（新しい順）」で、作成日時の順ではない
//   3. まだ支払いが無いイベントは作成日時で代わりに並ぶ
//   4. FirestoreのTimestamp形式（seconds）でも比較できる

import assert from 'node:assert/strict';
import { toMillis, eventActivityMillis, sortEventsByActivity, splitEventsByEnded } from '../src/lib/eventList.js';

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

const ts = (sec) => ({ seconds: sec, nanoseconds: 0 }); // FirestoreのTimestamp相当

test('toMillisはFirestoreのTimestampも数値もDateも同じ基準に揃える', () => {
  assert.equal(toMillis(null), 0);
  assert.equal(toMillis(1000), 1000);
  assert.equal(toMillis(ts(2)), 2000);
  assert.equal(toMillis(new Date(5000)), 5000);
});

test('作成日時ではなく、最後にお支払いが動いた日時で並ぶ', () => {
  const events = [
    { id: 'old-but-active', createdAt: ts(1), lastActivityAt: ts(100) },
    { id: 'new-but-quiet', createdAt: ts(50), lastActivityAt: ts(10) },
  ];
  const sorted = sortEventsByActivity(events);
  assert.deepEqual(sorted.map((e) => e.id), ['old-but-active', 'new-but-quiet']);
});

test('支払いがまだ無いイベントは作成日時で代わりに並ぶ', () => {
  const events = [
    { id: 'has-payment', createdAt: ts(1), lastActivityAt: ts(5) },
    { id: 'no-payment-yet', createdAt: ts(10) }, // lastActivityAtが無い
  ];
  const sorted = sortEventsByActivity(events);
  // 支払い済み(5) < 作成のみ(10) なので、作成のみの方が新しい扱いで先に出る
  assert.deepEqual(sorted.map((e) => e.id), ['no-payment-yet', 'has-payment']);
  assert.equal(eventActivityMillis(events[1]), 10000);
});

test('終了済み(ended)は進行中から外れ、両方が別枠で取り出せる', () => {
  const events = [
    { id: 'a', ended: false },
    { id: 'b', ended: true },
    { id: 'c' }, // ended未設定＝進行中扱い
  ];
  const { ongoing, ended } = splitEventsByEnded(events);
  assert.deepEqual(ongoing.map((e) => e.id), ['a', 'c']);
  assert.deepEqual(ended.map((e) => e.id), ['b']);
});

test('元の配列は書き換えない', () => {
  const events = [{ id: 'x', createdAt: ts(1) }, { id: 'y', createdAt: ts(2) }];
  const before = events.map((e) => e.id);
  sortEventsByActivity(events);
  assert.deepEqual(events.map((e) => e.id), before);
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
