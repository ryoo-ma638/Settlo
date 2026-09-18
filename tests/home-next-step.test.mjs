import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextStepOf } from '../src/lib/paymentOverview.js';

const g = (amount = 0, n = 0) => ({ amount, items: Array.from({ length: n }, (_, i) => ({ id: `x${i}` })) });
const make = (o = {}) => ({
  receive: { unpaid: g(), pending: g(), review: g(), event: g(), ...(o.receive || {}) },
  pay: { unpaid: g(), pending: g(), review: g(), event: g(), ...(o.pay || {}) },
});

test('未払いが残っていたら、それを出す（片付いたとは言わない）', () => {
  const r = nextStepOf(make({ pay: { unpaid: g(3000, 1) } }));
  assert.equal(r.todo, true);
  assert.equal(r.title, '未払いが ¥3,000 残っています');
});

test('未払いが無くても、イベントで精算中ならそう出す', () => {
  const r = nextStepOf(make({ pay: { event: g(3000, 1) } }));
  assert.equal(r.todo, true);
  assert.match(r.title, /イベントでまとめて精算中/);
});

test('自分の未払いが無く、相手待ちだけなら催促を促す', () => {
  const r = nextStepOf(make({ receive: { unpaid: g(5500, 3) } }));
  assert.equal(r.todo, false);
  assert.equal(r.title, '相手の支払いを待っています');
  assert.match(r.desc, /¥5,500/);
});

test('本当に何も無いときだけ「全部片付いています」', () => {
  const r = nextStepOf(make());
  assert.equal(r.todo, false);
  assert.equal(r.title, '確認が必要な精算はありません');
  assert.equal(r.desc, 'いまは全部片付いています');
});

test('未払いとイベントの両方があるときは、先に未払いを出す', () => {
  const r = nextStepOf(make({ pay: { unpaid: g(1000, 1), event: g(3000, 1) } }));
  assert.equal(r.title, '未払いが ¥1,000 残っています');
});

test('壊れた入力でも落ちない', () => {
  assert.equal(nextStepOf(undefined).title, '確認が必要な精算はありません');
  assert.equal(nextStepOf({}).title, '確認が必要な精算はありません');
});
