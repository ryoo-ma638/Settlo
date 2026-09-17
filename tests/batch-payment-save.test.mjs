// 複数レシートの一括登録の保存部分。
// 画面から手で確かめにくいところ（人数分の取引・再送・編集画面との互換）を、
// 偽のFirestoreに差し替えて毎回確かめる。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setFirestoreBindings, prepareSaveIds, saveOnePayment } from '../src/lib/batchPaymentSave.js';

// 本物のFirestoreの代わり。書き込みは確定処理が終わってからまとめて反映する。
function fakeFirestore() {
  const db = { __db: true };
  const store = new Map();
  let auto = 0;
  const collection = (_db, ...path) => ({ __col: path.join('/') });
  const doc = (a, ...rest) => {
    if (a && a.__db) return { __path: rest.join('/'), id: rest[rest.length - 1] };
    auto += 1;
    return { __path: `${a.__col}/auto${auto}`, id: `auto${auto}` };
  };
  const increment = (n) => ({ __inc: n });
  const runTransaction = async (_db, fn) => {
    const writes = [];
    const tx = {
      get: async (ref) => ({ exists: () => store.has(ref.__path), data: () => store.get(ref.__path) }),
      set: (ref, data) => writes.push(['set', ref.__path, data]),
      update: (ref, data) => writes.push(['update', ref.__path, data]),
    };
    const out = await fn(tx);
    for (const [op, path, data] of writes) {
      if (op === 'set') { store.set(path, data); continue; }
      const cur = store.get(path) || {};
      const next = { ...cur };
      for (const [k, v] of Object.entries(data)) {
        next[k] = v && v.__inc !== undefined ? (Number(cur[k]) || 0) + v.__inc : v;
      }
      store.set(path, next);
    }
    return out;
  };
  return {
    store,
    bindings: {
      db, doc, collection, runTransaction, increment,
      serverTimestamp: () => '__ts',
      getDocFromServer: async (ref) => ({
        exists: () => store.has(ref.__path),
        data: () => store.get(ref.__path),
        metadata: { fromCache: false, hasPendingWrites: false },
      }),
      ensurePaymentThread: async () => {},
      paymentThreadId: () => 't1',
    },
  };
}

const EVENT = 'ev1';
const ME = 'me', A = 'friendA', B = 'friendB';
const base = (store) => {
  store.set(`events/${EVENT}`, { participants: [ME, A, B], totalAmount: 0, ended: false });
};
const args = (ids) => ({
  eventId: EVENT,
  eventName: '旅行',
  creditorUid: ME,
  participantUids: [ME, A, B],
  participantNames: { [ME]: '自分', [A]: 'Aさん', [B]: 'Bさん' },
  payment: { amount: 900, itemName: '夕食', splitType: 'all', date: '2026/09/19', time: '19:00' },
  shares: [
    { uid: ME, name: '自分', amount: 300 },
    { uid: A, name: 'Aさん', amount: 300 },
    { uid: B, name: 'Bさん', amount: 300 },
  ],
  ids,
});
const txPaths = (store) => [...store.keys()].filter((k) => k.startsWith('transactions/'));

test('複数人の負担があるとき、立替者を除いた人数分の取引が作られ、合計が総額と一致する', async () => {
  const f = fakeFirestore(); setFirestoreBindings(f.bindings); base(f.store);
  const ids = await prepareSaveIds({ eventId: EVENT, creditorUid: ME, shares: args({}).shares });
  assert.equal(ids.transactions.length, 2, '立替者本人の分は取引を作らない');

  const r = await saveOnePayment(args(ids));
  assert.equal(r.status, 'saved');
  assert.equal(txPaths(f.store).length, 2);
  const amounts = txPaths(f.store).map((p) => f.store.get(p).amount).sort((x, y) => x - y);
  assert.deepEqual(amounts, [300, 300]);
  assert.equal(f.store.get(`events/${EVENT}`).totalAmount, 900, 'イベント合計が総額と一致する');
  setFirestoreBindings(null);
});

test('同じIDで送り直しても、取引の件数もイベント合計も増えない', async () => {
  const f = fakeFirestore(); setFirestoreBindings(f.bindings); base(f.store);
  const ids = await prepareSaveIds({ eventId: EVENT, creditorUid: ME, shares: args({}).shares });

  const first = await saveOnePayment(args(ids));
  assert.equal(first.status, 'saved');
  const countAfterFirst = txPaths(f.store).length;
  const totalAfterFirst = f.store.get(`events/${EVENT}`).totalAmount;

  const second = await saveOnePayment(args(ids));
  assert.equal(second.status, 'already', '2回目は既に確定済みとして扱う');
  assert.equal(txPaths(f.store).length, countAfterFirst, '取引が増えない');
  assert.equal(f.store.get(`events/${EVENT}`).totalAmount, totalAfterFirst, '合計が二重に足されない');
  assert.equal(totalAfterFirst, 900);
  setFirestoreBindings(null);
});

test('保存した履歴は、既存の編集画面が読む形になっている', async () => {
  const f = fakeFirestore(); setFirestoreBindings(f.bindings); base(f.store);
  const ids = await prepareSaveIds({ eventId: EVENT, creditorUid: ME, shares: args({}).shares });
  await saveOnePayment(args(ids));

  const hist = f.store.get(`events/${EVENT}/history/${ids.historyId}`);
  assert.ok(hist, '履歴が保存されている');
  for (const key of ['payer', 'payerUid', 'itemName', 'amount', 'splitType', 'shares', 'transactionIds', 'status', 'date', 'time']) {
    assert.ok(key in hist, `編集画面が読む項目が欠けている: ${key}`);
  }
  assert.equal(hist.payerUid, ME);
  assert.equal(hist.amount, 900);
  assert.equal(hist.transactionIds.length, 2);
  // 負担額の合計は総額と1円もずれない
  assert.equal(hist.shares.reduce((s, x) => s + Number(x.amount), 0), 900);
  // 名前で負担額を引く古い経路のために、名前が入っている
  assert.ok(hist.shares.every((x) => typeof x.name === 'string' && x.name.length > 0));
  setFirestoreBindings(null);
});

test('負担額の合計が総額と合わないときは、1件も書かずに止まる', async () => {
  const f = fakeFirestore(); setFirestoreBindings(f.bindings); base(f.store);
  const ids = await prepareSaveIds({ eventId: EVENT, creditorUid: ME, shares: args({}).shares });
  const bad = args(ids);
  bad.shares = [
    { uid: ME, name: '自分', amount: 300 },
    { uid: A, name: 'Aさん', amount: 300 },
    { uid: B, name: 'Bさん', amount: 299 }, // 1円足りない
  ];
  const r = await saveOnePayment(bad);
  assert.equal(r.status, 'failed');
  assert.equal(txPaths(f.store).length, 0, '取引を1件も作らない');
  assert.equal(f.store.get(`events/${EVENT}`).totalAmount, 0, '合計を足さない');
  setFirestoreBindings(null);
});

test('0円の人と立替者本人には取引を作らない', async () => {
  const f = fakeFirestore(); setFirestoreBindings(f.bindings); base(f.store);
  const shares = [
    { uid: ME, name: '自分', amount: 600 },
    { uid: A, name: 'Aさん', amount: 300 },
    { uid: B, name: 'Bさん', amount: 0 },
  ];
  const ids = await prepareSaveIds({ eventId: EVENT, creditorUid: ME, shares });
  assert.equal(ids.transactions.length, 1);
  const r = await saveOnePayment({ ...args(ids), shares });
  assert.equal(r.status, 'saved');
  assert.equal(txPaths(f.store).length, 1);
  assert.equal(f.store.get(txPaths(f.store)[0]).amount, 300);
  setFirestoreBindings(null);
});
