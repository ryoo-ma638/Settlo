import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildGuideActions } from '../src/lib/guideActions.js';
import { buildPaymentOverview, headlineOf } from '../src/lib/paymentOverview.js';

// デモの種データ（イベントのまとめて精算を開始した直後の状態）。
// tx1〜tx4 は精算に予約ずみ（eventSettlementPlanId つき）、tx5・tx6 はイベント外の取引。
const G = 'guest-uid';
const T = 'demo-user-taro';
const H = 'demo-user-hanako';
const NAME = { [G]: 'ゲスト', [T]: 'デモ太郎', [H]: 'デモ花子' };
const PLAN = { eventId: 'event1', eventSettlementPlanId: 'plan1', eventSettlementNet: { [G]: 1000, [T]: 4000, [H]: -5000 } };
const TXS = [
  { id: 'tx1', paidById: T, paidToId: G, amount: 2000, status: 'unpaid', ...PLAN },
  { id: 'tx2', paidById: H, paidToId: G, amount: 2000, status: 'unpaid', ...PLAN },
  { id: 'tx3', paidById: G, paidToId: T, amount: 3000, status: 'unpaid', ...PLAN },
  { id: 'tx4', paidById: H, paidToId: T, amount: 3000, status: 'unpaid', ...PLAN },
  { id: 'tx5', paidById: H, paidToId: G, amount: 1000, status: 'unpaid' },
  { id: 'tx6', paidById: G, paidToId: H, amount: 500, status: 'unpaid' },
];

// 購読（useGuideActions）が作る行と同じ形に直す。完了済みと相手UIDの無い行は購読側で除いている。
const rowsFor = (uid, key, otherKey) => TXS
  .filter((t) => t[key] === uid && t.status !== 'completed' && t[otherKey])
  .map((t) => ({
    id: t.id,
    name: NAME[t[otherKey]],
    amount: t.amount,
    status: t.status,
    eventSettlementPlanId: t.eventSettlementPlanId,
  }));
const actionsFor = (uid) => buildGuideActions(rowsFor(uid, 'paidToId', 'paidById'), rowsFor(uid, 'paidById', 'paidToId'));
const overviewFor = (uid) => buildPaymentOverview(TXS.filter((t) => t.paidById === uid || t.paidToId === uid), uid);

test('まとめて精算に予約ずみの取引は、アシスタントの「次にやること」に出さない', () => {
  const acts = actionsFor(G);
  const reserved = new Set(['tx1', 'tx2', 'tx3', 'tx4']);
  assert.equal(acts.some((a) => [...reserved].some((id) => a.to.includes(id))), false);
  // イベント外の2件（花子へ ¥500 支払う／花子から ¥1,000 催促）だけが残る。
  assert.equal(acts.length, 2);
  assert.deepEqual(acts.map((a) => a.kind), ['pay', 'remind']);
  assert.match(acts[0].text, /デモ花子さんに ¥500 の未払い/);
  assert.match(acts[1].text, /デモ花子さんが ¥1,000 未払い/);
});

test('アシスタントの件数が、ホームの未精算の件数と食い違わない', () => {
  // ホームはイベントで精算中の分を別区分（event）に置く。アシスタントはそこを扱わないので、
  // 比べる相手は「イベント以外の未精算」＝ unpaid・pending・review の件数。
  const homeCount = (uid) => {
    const ov = overviewFor(uid);
    return ['receive', 'pay'].reduce((total, side) => total
      + ['unpaid', 'pending', 'review'].reduce((n, state) => n + ov[side][state].items.length, 0), 0);
  };
  assert.equal(actionsFor(G).length, homeCount(G));
  assert.equal(actionsFor(G).length, 2);
  // 太郎の取引は3件すべて精算に予約ずみなので、やることは残らない。
  assert.equal(actionsFor(T).length, homeCount(T));
  assert.equal(actionsFor(T).length, 0);
});

test('太郎のホームが「支払う ¥0」のとき、アシスタントも支払いを出さない', () => {
  const pay = headlineOf(overviewFor(T), 'pay');
  assert.equal(pay.amount, 0);
  assert.equal(actionsFor(T).some((a) => a.kind === 'pay'), false);
});

test('購読した行に eventSettlementPlanId を持たせている', () => {
  // 行に印が無いと除外の判定ができないので、購読側の map を守る。
  const source = readFileSync(new URL('../src/composables/useGuideActions.js', import.meta.url), 'utf8');
  assert.equal((source.match(/eventSettlementPlanId: data\.eventSettlementPlanId/g) || []).length, 2);
  assert.match(source, /buildGuideActions/);
});
