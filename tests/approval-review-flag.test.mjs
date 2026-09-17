// 「送金状況の確認が必要」という印（approvalReviewRequired）の書き手を確かめるテスト。
//   実行: node --test tests/approval-review-flag.test.mjs
//
// この印は、まとめて精算を相手に差し戻されたときに立つ。
// 立っている取引は次のまとめて精算の対象から外れるので、
// 「立てる場所」と同じだけ「消す場所」が無いと、その取引は二度と精算できなくなる。
// そこで、次の5つを確かめる。
//   1. 状態ごとの更新内容が、状態と印の両方を必ず持っている
//   2. src の中で取引の状態を書き換えている場所が、すべてその決まった形を使っている
//      （＝生の { status: ... } を書いて印を消し忘れる場所が残っていない）
//   3. 差し戻しが、相殺に使った逆方向の取引にも印を立てる
//   4. 印が立った取引は、まとめて精算の対象から外れて別枠に出る
//   5. 承認・支払い直しで印が消え、通常の流れに戻れる（＝詰まない）

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  UNPAID_PATCH, REJECTED_PATCH, COMPLETED_PATCH, AWAITING_PATCH,
} from '../src/lib/transactionPatch.js';
import { buildPaymentOverview, actionablePaymentItems } from '../src/lib/paymentOverview.js';

// ---------- 1. 更新内容の形 ----------

test('状態ごとの更新内容が、状態と確認の印を必ず両方持っている', () => {
  const patches = { UNPAID_PATCH, REJECTED_PATCH, COMPLETED_PATCH, AWAITING_PATCH };
  for (const [name, patch] of Object.entries(patches)) {
    assert.ok('status' in patch, `${name} に status が無い`);
    assert.ok('approvalReviewRequired' in patch, `${name} に確認の印が無い`);
    assert.equal(typeof patch.approvalReviewRequired, 'boolean', `${name} の印が真偽値でない`);
  }
  // 印を立てるのは差し戻しだけ。それ以外はすべて消す側。
  assert.equal(REJECTED_PATCH.approvalReviewRequired, true);
  assert.equal(UNPAID_PATCH.approvalReviewRequired, false);
  assert.equal(COMPLETED_PATCH.approvalReviewRequired, false);
  assert.equal(AWAITING_PATCH.approvalReviewRequired, false);
  // 差し戻しは未払いへ戻す扱いなので、相殺の記録も消えていること
  assert.equal(REJECTED_PATCH.status, 'unpaid');
  assert.equal(REJECTED_PATCH.settlementBatch, null);
});

// ---------- 2. 書き換える場所の走査 ----------

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = dir + name;
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full + '/'));
    else if (/\.(js|vue)$/.test(name)) out.push(full);
  }
  return out;
}

// updateDoc(第1引数, 第2引数) を括弧の対応で切り出す
function updateDocCalls(text) {
  const calls = [];
  const re = /updateDoc\(/g;
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    let depth = 1, i = start;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
      i += 1;
    }
    const args = text.slice(start, i - 1);
    let nest = 0, cut = -1;
    for (let k = 0; k < args.length; k += 1) {
      const c = args[k];
      if ('({['.includes(c)) nest += 1;
      else if (')}]'.includes(c)) nest -= 1;
      else if (c === ',' && nest === 0) { cut = k; break; }
    }
    if (cut >= 0) calls.push({ target: args.slice(0, cut), patch: args.slice(cut + 1) });
  }
  return calls;
}

const ALLOWED = ['...UNPAID_PATCH', '...REJECTED_PATCH', '...COMPLETED_PATCH', '...AWAITING_PATCH'];

test('取引の状態を書き換える場所が、すべて決まった形を使っている', () => {
  const files = sourceFiles(SRC_DIR);
  assert.ok(files.length > 20, 'ソースを読めていない');
  let viaPatch = 0;
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const where = file.replace(SRC_DIR, 'src/');
    for (const call of updateDocCalls(text)) {
      if (!call.target.includes('transactions')) continue;
      const known = ALLOWED.some((form) => call.patch.includes(form))
        // PaymentDetailView の一括更新だけは状態→更新内容の表(STATUS_PATCH)を通す
        || (call.patch.includes('...patch') && text.includes('const STATUS_PATCH = {'));
      if (known) { viaPatch += 1; continue; }
      // 決まった形を使っていないのに status を直接書いている＝印の消し忘れが起きる場所
      assert.ok(
        !/\bstatus\s*:/.test(call.patch),
        `${where} が生の status を書いている: ${call.patch.trim()}`,
      );
    }
  }
  // 走査そのものが空振りしていないこと（決まった形を使う場所が実在する）
  assert.ok(viaPatch >= 10, `状態を書き換える場所を見つけられていない（${viaPatch}件）`);
});

test('状態と更新内容の表が、印を消さない状態を作っていない', () => {
  const text = readFileSync(SRC_DIR + 'views/PaymentDetailView.vue', 'utf8');
  const table = text.slice(text.indexOf('const STATUS_PATCH = {'));
  const body = table.slice(0, table.indexOf('};') + 2);
  // 表に並ぶのは、印を必ず書き換える4つの更新内容だけ
  for (const name of ['UNPAID_PATCH', 'REJECTED_PATCH', 'COMPLETED_PATCH', 'AWAITING_PATCH']) {
    assert.ok(body.includes(name), `STATUS_PATCH に ${name} が無い`);
  }
  // 差し戻しは 'rejected' で呼ぶ。'unpaid' で呼ぶと印が立たない
  assert.ok(text.includes("updateAllItems('rejected')"), '拒否が rejected を使っていない');
  assert.ok(!text.includes("updateAllItems('unpaid')"), '拒否が unpaid のままになっている');
});

// ---------- 3. 差し戻しの実処理 ----------

const mockUrl = 'data:text/javascript;base64,' + Buffer.from(`
export const db = {};
export const io = { rows: [], writes: [] };
export const doc = (_db, ...p) => p;
export const collection = doc;
export const where = (field, op, value) => ({ field, value });
export const query = (ref, ...filters) => ({ filters });
export const getDoc = async (p) => {
  const row = io.rows.find((r) => r.id === p.at(-1));
  return { exists: () => Boolean(row), data: () => row };
};
export const getDocs = async () => ({ docs: [] });
export const updateDoc = async (p, data) => {
  const id = p.at(-1);
  io.writes.push({ id, data });
  const row = io.rows.find((r) => r.id === id);
  if (row) Object.assign(row, data);
};
export const postPaymentEventByTx = async () => {};
`).toString('base64');

const realPatchUrl = new URL('../src/lib/transactionPatch.js', import.meta.url).href;
const settlementSource = readFileSync(new URL('../src/lib/settlement.js', import.meta.url), 'utf8')
  .replace(/from ['"]([^'"]+)['"]/g, (_all, name) => 'from ' + JSON.stringify(
    name === './transactionPatch' ? realPatchUrl : mockUrl,
  ));
const settlement = await import('data:text/javascript;base64,' + Buffer.from(settlementSource).toString('base64'));
const { io } = await import(mockUrl);

test('差し戻しは、相殺に使った逆方向の取引にも確認の印を立てる', async () => {
  io.rows = [{ id: 'counter-1', paidById: 'friend', paidToId: 'me', amount: 1000, status: 'completed' }];
  io.writes = [];
  const reverted = await settlement.revertCounterTransactions({ myUid: 'me', otherUid: 'friend', ids: ['counter-1'] });
  assert.deepEqual(reverted, ['counter-1']);
  assert.equal(io.writes.length, 1);
  assert.equal(io.writes[0].data.status, 'unpaid');
  assert.equal(io.writes[0].data.approvalReviewRequired, true);
  assert.equal(io.writes[0].data.settlementBatch, null);
});

test('完了していない取引と、当事者以外の取引には触らない', async () => {
  io.rows = [
    { id: 'already-unpaid', paidById: 'friend', paidToId: 'me', amount: 500, status: 'unpaid' },
    { id: 'someone-else', paidById: 'other', paidToId: 'third', amount: 500, status: 'completed' },
  ];
  io.writes = [];
  const reverted = await settlement.revertCounterTransactions({
    myUid: 'me', otherUid: 'friend', ids: ['already-unpaid', 'someone-else'],
  });
  assert.deepEqual(reverted, []);
  assert.equal(io.writes.length, 0);
});

// ---------- 4・5. 画面に出る形 ----------

const row = (extra) => ({ id: 'tx1', paidById: 'me', paidToId: 'friend', amount: 333, status: 'unpaid', ...extra });

test('差し戻された取引は、まとめて精算の対象から外れて別枠に出る', () => {
  const overview = buildPaymentOverview([row(REJECTED_PATCH)], 'me');
  assert.equal(overview.pay.review.items.length, 1);
  assert.equal(overview.pay.review.amount, 333);
  assert.equal(overview.pay.unpaid.items.length, 0);
  // まとめて精算が拾うのは未払いと承認待ちだけ＝確認中の分を巻き込まない
  assert.deepEqual(actionablePaymentItems(overview, 'pay'), []);
});

test('支払い直し・承認で印が消え、通常の流れに戻る', () => {
  const rejected = row(REJECTED_PATCH);

  // 相手の承認待ちにやり直す
  const retried = { ...rejected, ...AWAITING_PATCH };
  assert.equal(retried.approvalReviewRequired, false);
  const afterRetry = buildPaymentOverview([retried], 'me');
  assert.equal(afterRetry.pay.review.items.length, 0);
  assert.equal(afterRetry.pay.pending.items.length, 1);
  assert.equal(actionablePaymentItems(afterRetry, 'pay').length, 1);

  // 承認されて完了になる
  const done = { ...rejected, ...COMPLETED_PATCH };
  assert.equal(done.approvalReviewRequired, false);
  const afterDone = buildPaymentOverview([done], 'me');
  assert.equal(afterDone.pay.review.items.length, 0);
  assert.equal(afterDone.pay.unpaid.items.length, 0);
  assert.equal(afterDone.pay.pending.items.length, 0);

  // 双方の合意で未精算へ戻した場合も印は残らない
  const restored = { ...rejected, ...UNPAID_PATCH };
  const afterRestore = buildPaymentOverview([restored], 'me');
  assert.equal(afterRestore.pay.review.items.length, 0);
  assert.equal(afterRestore.pay.unpaid.items.length, 1);
});

test('印が無い既存の取引は、これまでどおり未払いとして数える', () => {
  const overview = buildPaymentOverview([row({})], 'me');
  assert.equal(overview.pay.unpaid.items.length, 1);
  assert.equal(overview.pay.review.items.length, 0);
  assert.equal(actionablePaymentItems(overview, 'pay').length, 1);
});
