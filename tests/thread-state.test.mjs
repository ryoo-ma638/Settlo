import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePaymentThreadState, allTransactionsCompleted } from '../src/lib/threadState.js';

test('同じ立て替えの再保存で過去会話の参加者・未読を保持し、完了判定対象だけ更新する', () => {
  const existing = {
    participants: ['owner', 'member-a'],
    transactionIds: ['tx-old'],
    unread: { owner: 0, 'member-a': 4 },
  };
  const merged = mergePaymentThreadState(existing, {
    participants: ['owner', 'member-b'],
    transactionIds: ['tx-new'],
  });
  assert.deepEqual(merged.participants, ['owner', 'member-a']);
  assert.deepEqual(merged.transactionIds, ['tx-old', 'tx-new']);
  assert.deepEqual(merged.activeTransactionIds, ['tx-new']);
  assert.deepEqual(merged.unread, { owner: 0, 'member-a': 4 });
});

test('新しい会話では現在の参加者と取引だけを初期化する', () => {
  const state = mergePaymentThreadState(null, {
    participants: ['owner', 'member-a', 'member-a'],
    transactionIds: ['tx-a', 'tx-a'],
  });
  assert.deepEqual(state.participants, ['owner', 'member-a']);
  assert.deepEqual(state.transactionIds, ['tx-a']);
  assert.deepEqual(state.activeTransactionIds, ['tx-a']);
  assert.deepEqual(state.unread, { owner: 0, 'member-a': 0 });
});

test('存在しない取引を完了とみなさない', () => {
  assert.equal(allTransactionsCompleted([{ exists: false, status: null }]), false);
  assert.equal(allTransactionsCompleted([
    { exists: true, status: 'completed' },
    { exists: false, status: null },
  ]), false);
});

test('全取引が存在して完了したときだけ会話を片付ける', () => {
  assert.equal(allTransactionsCompleted([]), false);
  assert.equal(allTransactionsCompleted([{ exists: true, status: 'unpaid' }]), false);
  assert.equal(allTransactionsCompleted([
    { exists: true, status: 'completed' },
    { exists: true, status: 'completed' },
  ]), true);
});
