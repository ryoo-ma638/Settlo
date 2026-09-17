// 専用Firestore Emulatorだけで実行する。クラウド接続は禁止。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import * as sdk from 'firebase/firestore';

const projectId = process.env.EVENT_NET_RULES_PROJECT || 'demo-settlo-event-net-rules';
const host = '127.0.0.1';
const port = Number(process.env.EVENT_NET_RULES_PORT || 8092);
if (!/^demo-settlo-event-net-[a-z0-9-]+$/.test(projectId)) throw new Error('専用demoプロジェクトを指定してください。');
if (process.env.FIRESTORE_EMULATOR_HOST !== `${host}:${port}`) throw new Error(`FIRESTORE_EMULATOR_HOST=${host}:${port} を指定してください。`);

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore');
const adminApp = initializeAdminApp({ projectId }, 'event-net-rules-admin');
const adminDb = getAdminFirestore(adminApp);
adminDb.settings({ host: `${host}:${port}`, ssl: false });

const apps = [];
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'local-test-key', appId: `local-${uid}` }, `event-net-${uid}`);
  apps.push(app);
  const db = sdk.getFirestore(app);
  sdk.connectFirestoreEmulator(db, host, port, { mockUserToken: { sub: uid, user_id: uid } });
  return db;
}
const a = client('A');
const b = client('B');
const c = client('C');
const outsider = client('X');
const eventId = `event-${Date.now().toString(36)}`;
const txId = `${eventId}-tx`;
const planId = `${eventId}-plan`;
const eventRef = sdk.doc(a, 'events', eventId);
const txRef = db => sdk.doc(db, 'transactions', txId);
const planRef = db => sdk.doc(db, 'eventSettlementPlans', planId);
const legRef = db => sdk.doc(db, 'eventSettlementPlans', planId, 'legs', 'leg-1');

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (error) { console.error(`  NG  ${name}`, error); process.exitCode = 1; }
};
const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');

try {
  await sdk.setDoc(eventRef, { participants: ['A', 'B', 'C'], name: '架空イベント' });
  await sdk.setDoc(txRef(a), { paidById: 'A', paidToId: 'B', amount: 1000, status: 'unpaid', eventId });

  await check('未予約の既存取引は当事者が従来どおり更新できる', async () => {
    await sdk.updateDoc(txRef(a), { itemName: '確認用' });
    assert.equal((await sdk.getDoc(txRef(b))).data().itemName, '確認用');
  });

  await check('クライアントは元取引へplanIdを付けられない', async () => {
    await denied(sdk.updateDoc(txRef(a), { eventSettlementPlanId: planId }));
  });

  await check('クライアントはイベントへ進行中planIdを付けられない', async () => {
    await denied(sdk.updateDoc(eventRef, { activeEventSettlementPlanId: planId }));
    await denied(sdk.updateDoc(eventRef, { lastEventSettlementPlanId: planId }));
  });

  await check('参加者でも精算計画と送金行を直接作れない', async () => {
    await denied(sdk.setDoc(planRef(a), { eventId, participants: ['A', 'B', 'C'], status: 'open' }));
    await denied(sdk.setDoc(legRef(a), { fromId: 'A', toId: 'C', amount: 1000, status: 'unpaid' }));
  });

  // Cloud Functions（Admin SDK）だけが、計画作成と元取引の予約を同時に書く。
  const batch = adminDb.batch();
  batch.set(adminDb.doc(`eventSettlementPlans/${planId}`), { eventId, participants: ['A', 'B', 'C'], status: 'open' });
  batch.set(adminDb.doc(`eventSettlementPlans/${planId}/legs/leg-1`), { fromId: 'A', toId: 'C', amount: 1000, status: 'unpaid' });
  batch.update(adminDb.doc(`transactions/${txId}`), { eventSettlementPlanId: planId });
  batch.update(adminDb.doc(`events/${eventId}`), { activeEventSettlementPlanId: planId });
  await batch.commit();

  await check('まとめて精算中は参加者を変更できないが、イベント名は更新できる', async () => {
    await denied(sdk.updateDoc(eventRef, { participants: ['A', 'B'] }));
    await sdk.updateDoc(eventRef, { name: '架空イベント・更新後' });
    assert.equal((await sdk.getDoc(eventRef)).data().name, '架空イベント・更新後');
  });

  await check('計画は参加者だけが読める', async () => {
    assert.equal((await sdk.getDoc(planRef(a))).data().status, 'open');
    assert.equal((await sdk.getDoc(legRef(c))).data().amount, 1000);
    await denied(sdk.getDoc(planRef(outsider)));
    await denied(sdk.getDoc(legRef(outsider)));
  });

  await check('予約中の元取引は当事者・受取人・第三の参加者の全員が直接変更・削除できない', async () => {
    for (const db of [a, b, c]) {
      await denied(sdk.updateDoc(txRef(db), { status: 'completed' }));
      await denied(sdk.deleteDoc(txRef(db)));
    }
  });

  await check('送金行は支払人・受取人・第三の参加者の全員が直接変更できない', async () => {
    for (const db of [a, b, c]) await denied(sdk.updateDoc(legRef(db), { status: 'completed' }));
  });
} finally {
  await Promise.all(apps.map(deleteApp));
  await deleteAdminApp(adminApp);
}
console.log(`\nFirestore rules: ${passed}/8 件 合格`);
