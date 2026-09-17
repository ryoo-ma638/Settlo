import test from 'node:test';
import assert from 'node:assert/strict';
import { evenShares } from '../../src/lib/evenShares.js';
import { isValidPaymentDate, setFirestoreBindings, saveOnePayment, confirmSavedOnServer, validateSavePlan } from '../../src/lib/batchPaymentSave.js';
import { people, clone, snapshot, fakeStore, plan } from './helpers.mjs';

test('端数・0円・上限を独立した期待値と照合し、入力を変えない', () => {
  const original = clone(people);
  for (const [total, expected] of [[1000,[333,333,334]],[1,[0,0,1]],[0,[0,0,0]],[99999999,[33333333,33333333,33333333]]]) {
    assert.deepEqual(evenShares(people, total, 'c').map(s => s.amount), expected);
  }
  for (const payer of ['a','b','c']) {
    for (const total of [2, 101, 10001, 99999998]) {
      const shares = evenShares(people, total, payer);
      assert.equal(shares.reduce((sum, s) => sum + s.amount, 0), total);
      assert.ok(shares.every(s => Number.isInteger(s.amount) && s.amount >= 0));
      assert.equal(shares.find(s => s.uid === payer).amount, Math.floor(total / 3) + total % 3);
    }
  }
  assert.deepEqual(evenShares([{id:'a',name:'同名'},{id:'b',name:'同名'}], 3, 'b').map(s => s.amount), [1,2]);
  assert.deepEqual(evenShares([people[0]], 19, 'a').map(s => s.amount), [19]);
  assert.deepEqual(people, original);
});
test('総額と参加者の不正入力を拒否する', () => {
  for (const total of [-1,1.5,'100',NaN,Infinity,100000000,null]) assert.throws(() => evenShares(people,total,'c'));
  for (const list of [null,[],[{}],[{id:' ',name:''}],[{id:1,name:''}],[{id:'a'}],[people[0],people[0]]]) assert.throws(() => evenShares(list,1,'a'));
  assert.throws(() => evenShares(people, 1, 'missing'));
});
test('日付の実在と閏年を検証する', () => {
  for (const date of ['2026/02/29','2026/04/31','2026/00/01','2026/13/01','2026/01/00','0000/01/01','2026-09-17']) assert.equal(isValidPaymentDate(date),false,date);
  for (const date of ['2024/02/29','2026/9/17','2000/02/29']) assert.equal(isValidPaymentDate(date),true,date);
});
test('保存計画の重複UID・取引ID・金額不一致・型不正を拒否する', async () => {
  setFirestoreBindings(fakeStore().bindings);
  const base = await plan();
  assert.equal(validateSavePlan(base).ok, true);
  for (const mutate of [
    p => p.participantUids.push('a'), p => p.shares[1].uid = 'a', p => p.shares.pop(), p => p.shares[0].amount++,
    p => p.ids.transactions[1].id = p.ids.transactions[0].id, p => p.ids.transactions[1].uid = 'a',
    p => p.ids.transactions[0].amount++, p => p.payment.amount = '1000', p => p.payment.amount = 0,
    p => p.payment = null, p => p.payment.date = '2026/02/30', p => p.ids.historyId = 'bad/id', p => p.shares[0].amount = '333',
  ]) { const input = clone(base); mutate(input); assert.equal(validateSavePlan(input).ok,false); }
});
test('取引・履歴・イベント合計を一括保存し、同一IDの同時送信で合計を増やさない（模擬保存）', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings);
  const input = await plan();
  const results = await Promise.all([saveOnePayment(input),saveOnePayment(input)]);
  assert.deepEqual(results.map(r => r.status), ['saved','already']);
  assert.equal(store.docs.get('events/demo-event').totalAmount,1000);
  const txs = [...store.docs].filter(([key]) => key.startsWith('transactions/')).map(([,data]) => data);
  assert.deepEqual(txs.map(t => t.amount), [333,333]);
  assert.ok(txs.every(t => t.historyId === input.ids.historyId && t.paidToId === 'c'));
  assert.equal(store.calls.threads,1);
});
test('終了済み・参加者変更・別内容の同一IDを上書きしない（模擬保存）', async () => {
  for (const change of [e => e.ended = true, e => e.participants.pop(), e => e.participants = ['a','a','c']]) {
    const store = fakeStore(); setFirestoreBindings(store.bindings); const input = await plan(); change(store.docs.get('events/demo-event'));
    assert.equal((await saveOnePayment(input)).status, 'failed'); assert.equal(store.docs.size,1);
  }
  const store = fakeStore(); setFirestoreBindings(store.bindings); const input = await plan();
  await saveOnePayment(input);
  const changed = clone(input); changed.payment.itemName = '別の店舗';
  assert.equal((await saveOnePayment(changed)).status,'unknown');
  assert.equal((await confirmSavedOnServer({ eventId:input.eventId, historyId:input.ids.historyId, plan:changed })).status,'unknown');
  assert.equal(store.docs.get('events/demo-event').totalAmount,1000);
});
test('応答不明・確実な拒否・サーバー再確認を区別（模擬保存）', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings); const input = await plan();
  const original = store.bindings.runTransaction;
  store.bindings.runTransaction = async (...args) => { await original(...args); throw Object.assign(new Error(), { code:'unavailable' }); };
  assert.equal((await saveOnePayment(input)).status,'unknown');
  assert.equal((await confirmSavedOnServer({eventId:input.eventId,historyId:input.ids.historyId,plan:input})).status,'saved');
  store.bindings.getDocFromServer = async () => ({...snapshot(undefined),metadata:{fromCache:true,hasPendingWrites:false}});
  assert.equal((await confirmSavedOnServer({eventId:input.eventId,historyId:input.ids.historyId})).status,'unknown');
  store.bindings.getDocFromServer = async () => snapshot(undefined);
  assert.equal((await confirmSavedOnServer({eventId:input.eventId,historyId:input.ids.historyId})).status,'failed');
  store.bindings.runTransaction = async () => { throw {code:'permission-denied'}; };
  assert.equal((await saveOnePayment(input)).status,'failed');
});
test('保存とチャットの時間切れを別に扱い、待ち続けない（模擬保存）', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings); const input = await plan();
  const original = store.bindings.runTransaction;
  store.bindings.runTransaction = () => new Promise(() => {});
  assert.equal((await saveOnePayment({...input,timeoutMs:5})).status,'unknown');
  store.bindings.runTransaction = original;
  store.bindings.ensurePaymentThread = () => new Promise(() => {});
  const result = await saveOnePayment({...input,sideEffectTimeoutMs:5});
  assert.equal(result.status,'saved'); assert.deepEqual(result.sideEffectFails,['チャット']);
});
