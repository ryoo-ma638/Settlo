// まとめ精算を拒否したときに、逆方向の取引が完了のまま残らないことを守るテスト。
//   実行: node --test tests/reject-order.test.mjs
//
// なぜ順序が大事か
//   逆方向の取引IDは「未読の承認リクエスト」からしか辿れない。
//   先にお知らせを既読にすると、自分で対象を見つけられなくしてしまい、
//   相手の分だけ完了のまま残る（＝片側だけ精算済みになる）。
//
// 確かめること
//   1. 未読のときだけ承認リクエストを見つけられる（＝既読にすると手遅れ）
//   2. 差し戻しで逆方向の取引が未払いへ戻り、確認の印が立つ
//   3. 3つの入口（決済の詳細・チャット・お知らせ）が、いずれも既読より先に対象を確定している

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = (p) => readFileSync(SRC + p, 'utf8');

// ---------- 本物の settlement.js を、偽のFirestoreで動かす ----------

const mockUrl = 'data:text/javascript;base64,' + Buffer.from(`
export const db = {};
export const io = { notifications: [], transactions: [], writes: [] };
export const doc = (_db, ...p) => p;
export const collection = (_db, name) => name;
export const where = (field, op, value) => ({ field, value });
export const query = (name, ...filters) => ({ name, filters });
export const getDocs = async (q) => {
  const rows = (q.name === 'notifications' ? io.notifications : io.transactions)
    .filter((r) => q.filters.every((f) => r[f.field] === f.value));
  return { docs: rows.map((r) => ({ id: r.id, data: () => r })) };
};
export const getDoc = async (p) => {
  const row = io.transactions.find((r) => r.id === p.at(-1));
  return { exists: () => Boolean(row), data: () => row };
};
export const updateDoc = async (p, data) => {
  const id = p.at(-1);
  io.writes.push({ id, data });
  const row = io.transactions.find((r) => r.id === id) || io.notifications.find((r) => r.id === id);
  if (row) Object.assign(row, data);
};
export const postPaymentEventByTx = async () => {};
`).toString('base64');

const realPatch = new URL('../src/lib/transactionPatch.js', import.meta.url).href;
const source = readFileSync(new URL('../src/lib/settlement.js', import.meta.url), 'utf8')
  .replace(/from ['"]([^'"]+)['"]/g, (_a, name) => 'from ' + JSON.stringify(
    name === './transactionPatch' ? realPatch : mockUrl,
  ));
const settlement = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const { io } = await import(mockUrl);

const request = (extra = {}) => ({
  id: 'notif-1', toUserId: 'me', fromUserId: 'friend', type: 'approval_request',
  isRead: false, transactionIds: ['main-1'], counterTransactionIds: ['counter-1'], ...extra,
});

test('承認リクエストは、未読のときだけ見つけられる', async () => {
  io.notifications = [request()];
  assert.equal((await settlement.findBatchApprovalRequests('me', ['main-1'])).length, 1);

  // 既読にした瞬間、同じ検索では見つからなくなる＝先に既読にすると手遅れ
  io.notifications = [request({ isRead: true })];
  assert.equal((await settlement.findBatchApprovalRequests('me', ['main-1'])).length, 0);
});

test('逆方向の記録が無い古いお知らせは対象にしない', async () => {
  io.notifications = [request({ counterTransactionIds: [] })];
  assert.equal((await settlement.findBatchApprovalRequests('me', ['main-1'])).length, 0);
});

test('差し戻すと、逆方向の取引が未払いへ戻り確認の印が立つ', async () => {
  io.transactions = [{ id: 'counter-1', paidById: 'friend', paidToId: 'me', amount: 2000, status: 'completed' }];
  io.writes = [];
  const reverted = await settlement.revertCounterTransactions({ myUid: 'me', otherUid: 'friend', ids: ['counter-1'] });
  assert.deepEqual(reverted, ['counter-1']);
  assert.equal(io.writes[0].data.status, 'unpaid');
  assert.equal(io.writes[0].data.approvalReviewRequired, true);
});

// ---------- 3つの入口の順序 ----------

const orderOf = (text, fnStart, first, second) => {
  const body = text.slice(text.indexOf(fnStart));
  const a = body.indexOf(first);
  const b = body.indexOf(second);
  assert.notEqual(a, -1, `${first} が見つからない`);
  assert.notEqual(b, -1, `${second} が見つからない`);
  return a < b;
};

test('決済の詳細：逆方向を戻してから、お知らせを既読にする', () => {
  const text = read('views/PaymentDetailView.vue');
  assert.ok(
    orderOf(text, 'const rejectPayment', 'revertBatchCounterparts()', 'clearApprovalNotifs()'),
    '既読化が先になっている。逆方向の取引が完了のまま残る',
  );
});

test('チャット：対象を探してから、お知らせを既読にする', () => {
  const text = read('views/ThreadView.vue');
  assert.ok(
    orderOf(text, 'const rejectTx', 'findBatchApprovalRequests', "isRead: true"),
    '既読化が先になっている',
  );
});

test('お知らせ：逆方向のIDを通知から直接受け取り、検索に頼らない', () => {
  const text = read('components/NotificationIcon.vue');
  const body = text.slice(text.indexOf('const rejectTx'));
  assert.ok(body.includes('req.counterTransactionIds'), '通知から逆方向のIDを取っていない');
  assert.ok(!body.slice(0, body.indexOf('revertCounterTransactions')).includes('findBatchApprovalRequests'),
    '検索に頼る形になっている');
});

test('未読限定の検索は settlement.js の1か所だけ', () => {
  // 検索条件を増やすなら、呼ぶ側の順序も見直す必要がある
  const text = readFileSync(new URL('../src/lib/settlement.js', import.meta.url), 'utf8');
  const hits = text.match(/where\('isRead', *'==', *false\)/g) || [];
  assert.equal(hits.length, 1);
});
