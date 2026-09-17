const test = require('node:test');
const assert = require('node:assert/strict');
const { publishForRequest, paymentAddedPushBody, pushPolicy } = require('../../functions/paymentAddedNotificationsCore.js');

const clone = value => JSON.parse(JSON.stringify(value));
const snap = value => ({ exists: value !== undefined, data: () => clone(value) });

function fakeDb() {
  const docs = new Map([
    ['events/e1', { name: '旅行', participants: ['u1', 'u2', 'u3', 'u4'] }],
    ['users/u1', { name: '登録者' }],
    ['events/e1/history/h1', { itemName: '朝食', amount: 1000, payerUid: 'u1', shares: [{uid:'u1',amount:334},{uid:'u2',amount:333},{uid:'u3',amount:333},{uid:'u4',amount:0}] }],
    ['events/e1/history/h2', { itemName: '夕食', amount: 2000, payerUid: 'u1', shares: [{uid:'u1',amount:668},{uid:'u2',amount:666},{uid:'u3',amount:666},{uid:'u4',amount:0}] }],
  ]);
  const ref = path => ({
    path,
    collection: name => ({ doc: id => ref(`${path}/${name}/${id}`) }),
  });
  const db = {
    collection: name => ({ doc: id => ref(`${name}/${id}`) }),
    runTransaction: async work => {
      const creates = [];
      const result = await work({
        get: async reference => snap(docs.get(reference.path)),
        create: (reference, data) => creates.push([reference.path, clone(data)]),
      });
      for (const [path, data] of creates) {
        if (docs.has(path)) throw new Error('already-exists');
        docs.set(path, data);
      }
      return result;
    },
  };
  return { db, docs };
}

test('保存済みだけに個別通知を作り、同じ登録の再試行で通知を増やさない', async () => {
  const { db, docs } = fakeDb();
  const input = { db, timestamp: () => 'server-time', authUid: 'u1', data: { eventId: 'e1', operationId: 'op-1', historyIds: ['h1', 'missing', 'h2'] } };
  const first = await publishForRequest(input);
  assert.deepEqual(first, { receiptCount: 2, recipientCount: 2, createdCount: 6 });
  const notifications = [...docs].filter(([path]) => path.startsWith('notifications/')).map(([, value]) => value);
  assert.equal(notifications.filter(item => item.type === 'payment_added').length, 4);
  assert.ok(notifications.filter(item => item.type === 'payment_added').every(item => item.suppressPush === true));
  const summaries = notifications.filter(item => item.type === 'payment_batch_added');
  assert.equal(summaries.length, 2);
  assert.ok(summaries.every(item => item.count === 2 && item.amount === 3000 && item.isRead === true));
  const second = await publishForRequest(input);
  assert.equal(second.createdCount, 0);
  assert.equal([...docs].filter(([path]) => path.startsWith('notifications/')).length, 6);
});

test('負担額0円の参加者へ送らず、受信者ごとに関係する明細だけを要約する', async () => {
  const { db, docs } = fakeDb();
  docs.set('events/e1/history/h2', { itemName:'夕食', amount:2000, payerUid:'u1', shares:[{uid:'u1',amount:1000},{uid:'u3',amount:1000},{uid:'u2',amount:0},{uid:'u4',amount:0}] });
  const result = await publishForRequest({ db, timestamp: () => 'server-time', authUid:'u1', data:{eventId:'e1',operationId:'op-2',historyIds:['h1','h2']} });
  assert.deepEqual(result, { receiptCount:2, recipientCount:2, createdCount:5 });
  const notifications = [...docs].filter(([path]) => path.startsWith('notifications/')).map(([, value]) => value);
  assert.equal(notifications.some(item => item.toUserId === 'u4'), false);
  const summaries = notifications.filter(item => item.type === 'payment_batch_added');
  assert.deepEqual(summaries.map(item => [item.toUserId,item.count,item.amount]).sort(), [['u2',1,1000],['u3',2,3000]]);
});

test('一部保存後の再確認でも同じ登録操作の要約通知を増やさない', async () => {
  const { db, docs } = fakeDb();
  const base = { db, timestamp: () => 'server-time', authUid:'u1' };
  await publishForRequest({ ...base, data:{eventId:'e1',operationId:'same-operation',historyIds:['h1']} });
  await publishForRequest({ ...base, data:{eventId:'e1',operationId:'same-operation',historyIds:['h2']} });
  const notifications = [...docs].filter(([path]) => path.startsWith('notifications/')).map(([, value]) => value);
  assert.equal(notifications.filter(item => item.type === 'payment_batch_added').length, 2, '受信者ごとに要約は1件だけ');
  assert.equal(notifications.filter(item => item.type === 'payment_added').length, 4, '個別のお知らせは各支払いを保持する');
  assert.ok(notifications.filter(item => item.type === 'payment_batch_added').every(item => item.operationId === 'same-operation'));
});

test('個別通知のpushを止め、要約だけに本文を作る', () => {
  assert.deepEqual(pushPolicy({ type:'payment_added', suppressPush:true }), { send:false, body:'' });
  const data = { type:'payment_batch_added', fromUserName:'登録者', count:2, amount:3000 };
  assert.deepEqual(pushPolicy(data), { send:true, body:'支払いが2件追加されました。内容はアプリで確認してください。' });
  assert.equal(paymentAddedPushBody(data), '支払いが2件追加されました。内容はアプリで確認してください。');
  assert.deepEqual(pushPolicy({ type:'unknown_type' }), { send:false, body:'' });
});
