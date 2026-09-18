import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headlineOf } from '../src/lib/paymentOverview.js';

const g = (amount = 0, n = 0) => ({ amount, items: Array.from({ length: n }, (_, i) => ({ id: `x${i}` })) });
const make = (o = {}) => ({
  receive: { unpaid: g(), pending: g(), review: g(), event: g(), ...(o.receive || {}) },
  pay: { unpaid: g(), pending: g(), review: g(), event: g(), ...(o.pay || {}) },
});

test('大きい数字は 未払い＋要確認＋イベント精算中 の合計', () => {
  const h = headlineOf(make({ pay: { unpaid: g(975, 1), review: g(2000, 1), event: g(5025, 1) } }), 'pay');
  assert.equal(h.amount, 8000);
  assert.equal(h.count, 3);
});

test('確認待ちは大きい数字に入れない（相手が確認した瞬間に減って見えるため）', () => {
  const h = headlineOf(make({ receive: { unpaid: g(1000, 1), pending: g(9999, 1) } }), 'receive');
  assert.equal(h.amount, 1000);
  assert.equal(h.count, 1);
});

test('要確認があるときだけ、その注記を足す', () => {
  const none = headlineOf(make({ pay: { unpaid: g(500, 1) } }), 'pay');
  assert.equal(none.notes.length, 0);
  const some = headlineOf(make({ pay: { unpaid: g(500, 1), review: g(2000, 1) } }), 'pay');
  assert.deepEqual(some.notes.map(n => n.kind), ['review']);
  assert.equal(some.notes[0].text, '送金状況の確認が必要 ¥2,000・1件');
});

test('イベント分が混ざっているときは「うち◯円」と書く', () => {
  const h = headlineOf(make({ receive: { unpaid: g(1000, 1), event: g(5025, 2) } }), 'receive');
  assert.deepEqual(h.notes.map(n => n.kind), ['event']);
  assert.equal(h.notes[0].text, 'うち ¥5,025 はイベントでまとめて精算中');
  assert.equal(h.caption, '相手の支払い待ち');
  assert.equal(h.eventOnly, false);
});

test('全部イベントで精算中なら、見出しごと「イベントで精算中」にする', () => {
  const h = headlineOf(make({ receive: { event: g(5025, 2) } }), 'receive');
  assert.equal(h.amount, 5025);
  assert.equal(h.eventOnly, true);
  assert.equal(h.caption, 'イベントで精算中');
  assert.equal(h.notes.length, 0, '見出しで言っているので注記は重ねない');
});

test('何も無いときの見出しは、いつもの名前のまま', () => {
  assert.equal(headlineOf(make(), 'receive').caption, '相手の支払い待ち');
  assert.equal(headlineOf(make(), 'pay').caption, '未払い');
  assert.equal(headlineOf(make(), 'pay').amount, 0);
});

test('壊れた入力でも落ちない', () => {
  assert.equal(headlineOf(undefined, 'pay').amount, 0);
  assert.equal(headlineOf({}, 'receive').amount, 0);
  assert.deepEqual(headlineOf({}, 'receive').notes, []);
});
