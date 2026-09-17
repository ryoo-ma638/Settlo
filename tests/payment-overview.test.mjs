import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionablePaymentItems, buildPaymentOverview } from '../src/lib/paymentOverview.js';

const tx = (id, paidById, paidToId, amount, status = 'unpaid', extra = {}) => ({ id, paidById, paidToId, amount, status, ...extra });
const amounts = (overview) => ({
  receive: Object.fromEntries(Object.entries(overview.receive).map(([key, value]) => [key, value.amount])),
  pay: Object.fromEntries(Object.entries(overview.pay).map(([key, value]) => [key, value.amount])),
});

test('受け取る2件を未払い・承認待ち・完了・差し戻し後に分ける', () => {
  const unpaid = tx('c', 'c', 'a', 1000);
  const reported = tx('b', 'b', 'a', 1000, 'awaiting_approval');
  let result = buildPaymentOverview([unpaid, reported], 'a');
  assert.deepEqual(amounts(result).receive, { unpaid: 1000, pending: 1000, review: 0 });
  result = buildPaymentOverview([unpaid, { ...reported, status: 'completed' }], 'a');
  assert.deepEqual(amounts(result).receive, { unpaid: 1000, pending: 0, review: 0 });
  result = buildPaymentOverview([unpaid, { ...reported, status: 'unpaid', approvalReviewRequired: true }], 'a');
  assert.deepEqual(amounts(result).receive, { unpaid: 1000, pending: 0, review: 1000 });
  assert.equal(result.receive.review.items[0].opponentUid, 'b');
});

test('両方向にある通常の承認待ちをreceiveとpayへ分ける', () => {
  const result = buildPaymentOverview([
    tx('receive', 'b', 'a', 700, 'awaiting_approval'),
    tx('pay', 'a', 'b', 400, 'awaiting_approval'),
  ], 'a');
  assert.equal(result.receive.pending.amount, 700);
  assert.equal(result.pay.pending.amount, 400);
});

const batch = { id: 'batch-1', payerUid: 'a', receiverUid: 'b', gross: 3000, offset: 2000, net: 1000, count: 2, counterCount: 1 };
const submittedBatch = (value = batch) => [
  tx('m1', 'a', 'b', 1000, 'awaiting_approval', { settlementBatch: { ...value, role: 'main', mainTransactionIds: ['m1', 'm2'], counterTransactionIds: ['o1'] } }),
  tx('m2', 'a', 'b', 2000, 'awaiting_approval', { settlementBatch: { ...value, role: 'main', mainTransactionIds: ['m1', 'm2'], counterTransactionIds: ['o1'] } }),
  tx('o1', 'b', 'a', 2000, 'completed', { settlementBatch: { ...value, role: 'offset', mainTransactionIds: ['m1', 'm2'], counterTransactionIds: ['o1'] } }),
];

test('まとめ承認待ちはcompletedのoffsetを足さずnetだけを1件にする', () => {
  const result = buildPaymentOverview(submittedBatch(), 'a');
  assert.equal(result.pay.pending.amount, 1000);
  assert.equal(result.pay.pending.items.length, 1);
  assert.equal(result.pay.pending.items[0].opponentUid, 'b');
  assert.equal(result.receive.pending.amount, 0);
  assert.deepEqual(result.issues, []);
});

test('同じまとめ精算を受取側から見るとreceiveの承認待ちになる', () => {
  const result = buildPaymentOverview(submittedBatch(), 'b');
  assert.equal(result.receive.pending.amount, 1000);
  assert.equal(result.receive.pending.items[0].opponentUid, 'a');
});

test('向きが異なるまとめ承認待ちをreceiveとpayへ混ぜずに置く', () => {
  const reverse = { id: 'batch-2', payerUid: 'b', receiverUid: 'a', gross: 900, offset: 400, net: 500, count: 1, counterCount: 1 };
  const reverseRows = [
    tx('r-main', 'b', 'a', 900, 'awaiting_approval', { settlementBatch: { ...reverse, role: 'main' } }),
    tx('r-offset', 'a', 'b', 400, 'completed', { settlementBatch: { ...reverse, role: 'offset' } }),
  ];
  const result = buildPaymentOverview([...submittedBatch(), ...reverseRows], 'a');
  assert.equal(result.pay.pending.amount, 1000);
  assert.equal(result.receive.pending.amount, 500);
  assert.equal(result.pay.pending.items.length, 1);
  assert.equal(result.receive.pending.items.length, 1);
});

test('netが0円でも承認待ちのitemsを残す', () => {
  const zero = { ...batch, gross: 2000, offset: 2000, net: 0, count: 1, counterCount: 1 };
  const rows = [
    tx('m1', 'a', 'b', 2000, 'awaiting_approval', { settlementBatch: { ...zero, role: 'main', mainTransactionIds: ['m1'], counterTransactionIds: ['o1'] } }),
    tx('o1', 'b', 'a', 2000, 'completed', { settlementBatch: { ...zero, role: 'offset', mainTransactionIds: ['m1'], counterTransactionIds: ['o1'] } }),
  ];
  const result = buildPaymentOverview(rows, 'a');
  assert.equal(result.pay.pending.amount, 0);
  assert.equal(result.pay.pending.items.length, 1);
});

test('差し戻しでbatch解除された元明細は差額を作らず各reviewへ戻す', () => {
  const rows = submittedBatch().map(({ settlementBatch, approvalRequestId, ...row }) => ({ ...row, status: 'unpaid', approvalReviewRequired: true }));
  const result = buildPaymentOverview(rows, 'a');
  assert.equal(result.pay.review.amount, 3000);
  assert.equal(result.receive.review.amount, 2000);
  assert.equal(result.pay.review.items.length, 2);
  assert.equal(result.receive.review.items.length, 1);
});

test('確認が必要な3件を新しいまとめ精算へ混ぜず、通常未払い333円だけを対象にする', () => {
  const reviewRows = submittedBatch().map(({ settlementBatch, approvalRequestId, ...row }) => ({
    ...row, status: 'unpaid', approvalReviewRequired: true,
  }));
  const extra = tx('extra', 'a', 'b', 333);
  const result = buildPaymentOverview([...reviewRows, extra], 'a');
  assert.deepEqual(actionablePaymentItems(result, 'pay').map((row) => row.id), ['extra']);
  assert.deepEqual(actionablePaymentItems(result, 'receive'), []);
  assert.equal(result.pay.review.amount, 3000);
  assert.equal(result.receive.review.amount, 2000);
});

test('同じIDは受取・支払の2購読に重なっても1回だけ数える', () => {
  const row = tx('same', 'b', 'a', 500);
  const result = buildPaymentOverview([row, { ...row }], 'a');
  assert.equal(result.receive.unpaid.amount, 500);
  assert.equal(result.receive.unpaid.items.length, 1);
});

test('壊れたbatchは通常取引や0円へ読み替えずissuesへ出す', () => {
  const malformed = submittedBatch({ ...batch, net: 999 });
  const result = buildPaymentOverview(malformed, 'a');
  assert.equal(result.pay.pending.amount, 0);
  assert.equal(result.pay.pending.items.length, 0);
  assert.deepEqual(result.issues.map((value) => value.code), ['batch_invalid']);
});

test('全件完了した古いbatchは構造が不足していても現在の未精算issuesへ出さない', () => {
  const malformed = submittedBatch({ ...batch, gross: 9999 }).map((row) => ({ ...row, status: 'completed' }));
  const result = buildPaymentOverview(malformed, 'a');
  assert.deepEqual(result.issues, []);
  assert.equal(result.receive.pending.amount + result.pay.pending.amount, 0);
});

test('活動中batchに第三者や逆向きでない明細が混ざれば集計しない', () => {
  const wrongMain = submittedBatch().map((row) => row.id === 'm2' ? { ...row, paidById: 'third-party' } : row);
  const mainResult = buildPaymentOverview(wrongMain, 'a');
  assert.equal(mainResult.pay.pending.amount, 0);
  assert.deepEqual(mainResult.issues.map((value) => value.code), ['batch_invalid']);

  const wrongOffset = submittedBatch().map((row) => row.id === 'o1' ? { ...row, paidById: 'a', paidToId: 'b' } : row);
  const offsetResult = buildPaymentOverview(wrongOffset, 'a');
  assert.equal(offsetResult.pay.pending.amount, 0);
  assert.deepEqual(offsetResult.issues.map((value) => value.code), ['batch_invalid']);
});

test('不正金額・不明UID・無関係・自分自身の取引を除外する', () => {
  const result = buildPaymentOverview([
    tx('negative', 'b', 'a', -1),
    tx('missing', '', 'a', 100),
    tx('other', 'b', 'c', 100),
    tx('self', 'a', 'a', 100),
  ], 'a');
  assert.deepEqual(amounts(result), {
    receive: { unpaid: 0, pending: 0, review: 0 },
    pay: { unpaid: 0, pending: 0, review: 0 },
  });
  assert.deepEqual(result.issues.map((value) => value.code), [
    'amount_invalid', 'party_uid_missing', 'viewer_not_in_transaction', 'self_transaction',
  ]);
});

test('イベント全体のまとめて精算に予約された取引は、相手ごとの集計に出さない', () => {
  // イベント側で1本にまとめて精算するので、相手ごとの画面にも出すと二重に精算できてしまう。
  const plain = tx('plain', 'b', 'a', 1000);
  const reserved = tx('reserved', 'c', 'a', 2000, 'unpaid', { eventSettlementPlanId: 'plan-1' });
  const result = buildPaymentOverview([plain, reserved], 'a');
  assert.deepEqual(amounts(result).receive, { unpaid: 1000, pending: 0, review: 0 });
  assert.deepEqual(result.receive.unpaid.items.map((item) => item.id), ['plain']);
  assert.deepEqual(actionablePaymentItems(result, 'receive').map((item) => item.id), ['plain']);
  // 予約済みは不正データではないので、警告としては出さない
  assert.deepEqual(result.issues, []);
});

test('予約済みは承認待ちでも差し戻し後でも同じように外す', () => {
  const pending = tx('p', 'b', 'a', 500, 'awaiting_approval', { eventSettlementPlanId: 'plan-1' });
  const review = tx('r', 'c', 'a', 700, 'unpaid', { eventSettlementPlanId: 'plan-1', approvalReviewRequired: true });
  const result = buildPaymentOverview([pending, review], 'a');
  assert.deepEqual(amounts(result).receive, { unpaid: 0, pending: 0, review: 0 });
});

test('予約が外れた取引は、これまでどおり集計へ戻る', () => {
  const row = tx('x', 'b', 'a', 1200, 'unpaid', { eventSettlementPlanId: 'plan-1' });
  assert.equal(buildPaymentOverview([row], 'a').receive.unpaid.amount, 0);
  assert.equal(buildPaymentOverview([{ ...row, eventSettlementPlanId: null }], 'a').receive.unpaid.amount, 1200);
  assert.equal(buildPaymentOverview([{ ...row, eventSettlementPlanId: '  ' }], 'a').receive.unpaid.amount, 1200);
});
