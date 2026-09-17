const test = require('node:test');
const assert = require('node:assert/strict');
const { policyForNotification, settingsAllowPush, shouldRefreshPaymentBatchPush } = require('../../functions/pushPolicyCore.js');

test('許可リスト外と個別支払い通知をプッシュしない', () => {
  assert.deepEqual(policyForNotification({ type:'unknown_type' }), { send:false });
  assert.deepEqual(policyForNotification({ type:'payment_added', suppressPush:true }), { send:false });
  assert.deepEqual(policyForNotification({ type:'profile_updated' }), { send:false });
  assert.deepEqual(policyForNotification({ type:'event_joined' }), { send:false });
  assert.deepEqual(policyForNotification({ type:'thread_reply' }), { send:false });
});

test('支払い追加は件数だけを出し、人名・金額・明細を含めない', () => {
  const result = policyForNotification({ type:'payment_batch_added', count:3, amount:9999, fromUserName:'人物名', itemName:'明細名' });
  assert.deepEqual(result, { send:true, category:'payments', body:'支払いが3件追加されました。内容はアプリで確認してください。' });
  assert.doesNotMatch(result.body, /人物名|9,999|9999|明細名/);
});

test('全体設定とカテゴリ設定の両方を確認する', () => {
  assert.equal(settingsAllowPush(undefined, 'payments'), true);
  assert.equal(settingsAllowPush({ pushEnabled:false, payments:true }, 'payments'), false);
  assert.equal(settingsAllowPush({ pushEnabled:true, payments:false }, 'payments'), false);
  assert.equal(settingsAllowPush({ pushEnabled:true, payments:true }, 'payments'), true);
  assert.equal(settingsAllowPush(undefined, 'events'), false);
});

test('同じ登録操作の要約件数が増えた時だけ同じ通知枠を更新する', () => {
  const before = { type:'payment_batch_added', toUserId:'u2', operationId:'op1', count:1 };
  assert.equal(shouldRefreshPaymentBatchPush(before, { ...before, count:2 }), true);
  assert.equal(shouldRefreshPaymentBatchPush(before, { ...before, count:1 }), false);
  assert.equal(shouldRefreshPaymentBatchPush(before, { ...before, operationId:'op2', count:2 }), false);
  assert.equal(shouldRefreshPaymentBatchPush(before, { ...before, toUserId:'u3', count:2 }), false);
  assert.equal(shouldRefreshPaymentBatchPush(before, { ...before, type:'payment_added', count:2 }), false);
});
