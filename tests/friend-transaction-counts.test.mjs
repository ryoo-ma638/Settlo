import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countFriendTransactions } from '../src/lib/friendTransactionCounts.js';

const transaction = (id, status = 'unpaid', extra = {}) => ({
  id, paidById: 'friend', paidToId: 'me', amount: 1000, status, ...extra,
});

test('未払い2件と精算済み1件を、受取・支払の向きにかかわらず3回と数える', () => {
  const rows = [transaction('one'), transaction('two', 'unpaid', { paidById: 'me', paidToId: 'friend' }), transaction('three', 'completed')];
  assert.equal(countFriendTransactions(rows, 'me').get('friend'), 3);
  assert.equal(countFriendTransactions(rows, 'friend').get('me'), 3);
});

test('まとめ精算の申請・拒否・再申請・完了で、元の明細3件の回数を変えない', () => {
  const rows = [transaction('one'), transaction('two'), transaction('three')];
  for (const status of ['awaiting_approval', 'unpaid', 'awaiting_approval', 'completed']) {
    const updated = rows.map(row => ({ ...row, status, settlementBatch: { id: 'batch', role: row.id === 'one' ? 'main' : 'offset' } }));
    assert.equal(countFriendTransactions(updated, 'me').get('friend'), 3);
  }
});

test('同じ取引が2つの取得結果に含まれても1回とし、相手ごとに分ける', () => {
  const row = transaction('same');
  const counts = countFriendTransactions([row, { ...row }, transaction('other', 'completed', { paidById: 'another' })], 'me');
  assert.deepEqual([...counts], [['friend', 1], ['another', 1]]);
});

test('他人同士・自分自身・相手やIDが不明のレコードを数えない', () => {
  const rows = [transaction('outside', 'unpaid', { paidToId: 'another' }), transaction('self', 'unpaid', { paidById: 'me' }), transaction('missing', 'unpaid', { paidById: null }), transaction('')];
  assert.equal(countFriendTransactions(rows, 'me').size, 0);
});

test('未取得やログアウトを、過去の件数の加算として扱わない', () => {
  const rows = [transaction('one')];
  assert.equal(countFriendTransactions(rows, 'me').get('friend'), 1);
  assert.equal(countFriendTransactions(rows, 'me').get('friend'), 1);
  assert.equal(countFriendTransactions([], 'me').size, 0);
  assert.equal(countFriendTransactions(rows, null).size, 0);
});

test('件数の計算は金額・状態・元の配列を変更しない', () => {
  const rows = Object.freeze([Object.freeze(transaction('one')), Object.freeze(transaction('two', 'completed'))]);
  const before = structuredClone(rows);
  countFriendTransactions(rows, 'me');
  assert.deepEqual(rows, before);
});

const { summarizeFriendTransactions } = await import('../src/lib/friendTransactionCounts.js');
test('同じ相手に未払い・自分の確認・相手の確認が共存し、完了分は未精算から除く', () => {
  const rows = [transaction('a'), transaction('b','awaiting_approval'), transaction('c','awaiting_approval',{paidById:'me',paidToId:'friend'}),transaction('d','completed')];
  assert.deepEqual(summarizeFriendTransactions(rows,'me').get('friend'), {unsettled:3,myConfirmation:1,theirConfirmation:1});
});
test('差額0でも未精算は残り、重複・別の人の明細は混ぜない', () => {
  const rows = [transaction('a'),transaction('b','unpaid',{paidById:'me',paidToId:'friend'}),transaction('a'),transaction('outside','awaiting_approval',{paidToId:'someone'})];
  assert.deepEqual(summarizeFriendTransactions(rows,'me').get('friend'),{unsettled:2,myConfirmation:0,theirConfirmation:0});
});
test('まとめ申請の逆方向が旧形式completedでも、申請中は同じ受取人の確認に数える', () => {
  for(const offsetStatus of ['completed','awaiting_approval']) {
    const batch={id:'batch',payerUid:'friend',receiverUid:'me'};
    const rows=[transaction('a','awaiting_approval',{settlementBatch:{...batch,role:'main'}}),transaction('b',offsetStatus,{paidById:'me',paidToId:'friend',settlementBatch:{...batch,role:'offset'}})];
    assert.deepEqual(summarizeFriendTransactions(rows,'me').get('friend'),{unsettled:2,myConfirmation:2,theirConfirmation:0});
    assert.deepEqual(summarizeFriendTransactions(rows.map(t=>({...t,status:'completed'})),'me').get('friend'),{unsettled:0,myConfirmation:0,theirConfirmation:0});
  }
});
test('取引なし・ログアウトと、状態不明を完了と取り違えない', () => {
  assert.equal(summarizeFriendTransactions([], 'me').size,0);
  assert.equal(summarizeFriendTransactions([transaction('a')],null).size,0);
  assert.equal(summarizeFriendTransactions([transaction('a',undefined)],'me').get('friend').unsettled,1);
});
