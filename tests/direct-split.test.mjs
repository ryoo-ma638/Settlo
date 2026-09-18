// イベントを作らずに、フレンドと2人で割り勘を記録するときの計算のテスト。
//   実行: node --test tests/direct-split.test.mjs
//
// 確かめること
//   1. 半分ずつのとき、割り切れない1円は立て替えた人が持つ
//   2. 全額・金額指定のとき、相手の負担額が正しい
//   3. おかしな入力は保存させない（0円・文字・合計超え・品名なし）
//   4. 誰が払ったかで、債権者と債務者が入れ替わる
//   5. イベントに属さない記録として作られる

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { debtorAmountOf, buildDirectTransaction, SPLIT_ERRORS } from '../src/lib/directSplit.js';

test('半分ずつ。割り切れない1円は立て替えた人が持つ', () => {
  assert.deepEqual(debtorAmountOf({ total: 3000, mode: 'half' }), { ok: true, amount: 1500 });
  assert.deepEqual(debtorAmountOf({ total: 3001, mode: 'half' }), { ok: true, amount: 1500 });
  assert.deepEqual(debtorAmountOf({ total: 1, mode: 'half' }), { ok: true, amount: 0 });
});

test('全額を相手が負担するとき', () => {
  assert.deepEqual(debtorAmountOf({ total: 2400, mode: 'all' }), { ok: true, amount: 2400 });
});

test('金額を指定するとき', () => {
  assert.deepEqual(debtorAmountOf({ total: 5000, mode: 'custom', customAmount: 1200 }), { ok: true, amount: 1200 });
  assert.equal(debtorAmountOf({ total: 5000, mode: 'custom', customAmount: 6000 }).reason, 'custom_over_total');
  assert.equal(debtorAmountOf({ total: 5000, mode: 'custom', customAmount: 0 }).reason, 'custom_invalid');
});

test('金額が数字でなければ保存させない', () => {
  for (const bad of ['', '　', 'たくさん', '1,000', '-500', '1.5', null, undefined, {}]) {
    assert.equal(debtorAmountOf({ total: bad, mode: 'half' }).ok, false, String(bad));
  }
});

test('自分が払ったときは、相手が債務者になる', () => {
  const r = buildDirectTransaction({ total: 3000, mode: 'half', itemName: 'ランチ', myUid: 'me', friendUid: 'you', iPaid: true });
  assert.equal(r.ok, true);
  assert.equal(r.transaction.paidById, 'you'); // 払う人
  assert.equal(r.transaction.paidToId, 'me');  // 立て替えた人
  assert.equal(r.transaction.amount, 1500);
});

test('相手が払ったときは、自分が債務者になる', () => {
  const r = buildDirectTransaction({ total: 3000, mode: 'half', itemName: 'ランチ', myUid: 'me', friendUid: 'you', iPaid: false });
  assert.equal(r.transaction.paidById, 'me');
  assert.equal(r.transaction.paidToId, 'you');
});

test('イベントに属さない記録として作られる', () => {
  const r = buildDirectTransaction({ total: 1000, mode: 'all', itemName: 'コーヒー', myUid: 'me', friendUid: 'you' });
  assert.equal('eventId' in r.transaction, false);
  assert.equal(r.transaction.eventName, '');
  assert.equal(r.transaction.status, 'unpaid');
  assert.equal(r.transaction.approvalReviewRequired, false);
});

test('品名が無ければ保存させない', () => {
  const r = buildDirectTransaction({ total: 1000, mode: 'half', itemName: '   ', myUid: 'me', friendUid: 'you' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'item_name_required');
});

test('相手が自分自身なら保存させない', () => {
  assert.equal(buildDirectTransaction({ total: 1000, mode: 'half', itemName: 'あ', myUid: 'me', friendUid: 'me' }).reason, 'party_invalid');
  assert.equal(buildDirectTransaction({ total: 1000, mode: 'half', itemName: 'あ', myUid: 'me', friendUid: '' }).reason, 'party_invalid');
});

test('品名は60字までにする', () => {
  const r = buildDirectTransaction({ total: 1000, mode: 'all', itemName: 'あ'.repeat(90), myUid: 'me', friendUid: 'you' });
  assert.equal(r.transaction.itemName.length, 60);
});

test('止める理由それぞれに、画面へ出す文章がある', () => {
  for (const key of ['amount_invalid', 'custom_invalid', 'custom_over_total', 'item_name_required', 'party_invalid']) {
    assert.ok(SPLIT_ERRORS[key], key);
  }
});
