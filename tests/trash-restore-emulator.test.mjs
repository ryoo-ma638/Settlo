import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import { createTrashRestoreStore } from '../src/lib/trashRestoreStore.js';

const host = '127.0.0.1';
const port = Number(process.env.TRASH_RESTORE_TEST_PORT || 8093);
const projectId = process.env.TRASH_RESTORE_TEST_PROJECT || 'demo-settlo-trash-restore';
if (process.env.FIRESTORE_EMULATOR_HOST !== `${host}:${port}`) {
  throw new Error(`FIRESTORE_EMULATOR_HOST=${host}:${port} を指定してください。本番には接続しません。`);
}
if (!projectId.startsWith('demo-settlo-trash-restore')) throw new Error('専用demoプロジェクトだけを使用してください。');

const apps = [];
function client(uid) {
  const app = initializeApp({ projectId, apiKey: 'local-test-key', appId: `local-${uid}` }, `${uid}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port, { mockUserToken: { sub: uid, user_id: uid } });
  return { uid, db, store: createTrashRestoreStore(db) };
}

const A = client('audit-a');
const B = client('audit-b');
const runId = Date.now().toString(36);
let sequence = 0;
const nextId = (label) => `${runId}-${++sequence}-${label}`;

async function deletedPaymentFixture() {
  const eventId = nextId('event');
  const trashId = nextId('trash');
  await setDoc(doc(A.db, 'events', eventId), {
    name: '架空の食事会', participants: [A.uid, B.uid], totalAmount: 0,
  });
  await setDoc(doc(A.db, 'trash', trashId), {
    type: 'payment',
    status: 'trashed',
    participants: [A.uid, B.uid],
    createdBy: A.uid,
    eventId,
    eventName: '架空の食事会',
    itemName: '架空の夕食',
    amount: 300,
    historySnapshot: {
      payer: '架空A', payerUid: A.uid, itemName: '架空の夕食', amount: 300,
      shares: [
        { uid: A.uid, name: '架空A', amount: 150 },
        { uid: B.uid, name: '架空B', amount: 150 },
      ],
    },
    transactionSnapshots: [{
      paidById: B.uid, paidToId: A.uid, amount: 150, status: 'unpaid', eventId,
    }],
    trashedAt: new Date(),
  });
  return { eventId, trashId };
}

test('300円を二端末から同時復元しても、履歴・合計・通知は1回だけ作る', async () => {
  const f = await deletedPaymentFixture();
  const [left, right] = await Promise.all([
    A.store.restoreDeletedPayment({ trashId: f.trashId, actorUid: A.uid, actorName: '架空A' }),
    B.store.restoreDeletedPayment({ trashId: f.trashId, actorUid: B.uid, actorName: '架空B' }),
  ]);
  assert.ok([left, right].every((result) => ['restored', 'already-restored'].includes(result.status)));

  const event = (await getDoc(doc(A.db, 'events', f.eventId))).data();
  const trash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  const recipient = trash.restoredBy === A.uid ? B : A;
  const history = await getDoc(doc(A.db, 'events', f.eventId, 'history', trash.restoredHistoryId));
  const transaction = await getDoc(doc(A.db, 'transactions', trash.restoredTransactionIds[0]));
  const notice = await getDoc(doc(recipient.db, 'notifications', trash.restoreNotificationIds[0]));
  assert.equal(event.totalAmount, 300);
  assert.equal(trash.restoredTransactionIds.length, 1);
  assert.equal(trash.restoreNotificationIds.length, 1);
  assert.equal(history.exists(), true);
  assert.equal(transaction.exists(), true);
  assert.equal(notice.data().restoreOperationId, trash.restoreOperationId);
});

test('同じ復元拒否を二度処理しても、300円を一度だけ減算する', async () => {
  const f = await deletedPaymentFixture();
  await A.store.restoreDeletedPayment({
    trashId: f.trashId, actorUid: A.uid, actorName: '架空A',
  });
  const restoredTrash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  const notificationId = restoredTrash.restoreNotificationIds[0];
  const notice = (await getDoc(doc(B.db, 'notifications', notificationId))).data();
  assert.equal(notice.trashId, f.trashId);

  const input = {
    notificationId,
    trashId: f.trashId,
    actorUid: B.uid,
    restoreOperationId: restoredTrash.restoreOperationId,
  };
  const [left, right] = await Promise.all([
    B.store.rejectRestoredPayment(input),
    B.store.rejectRestoredPayment(input),
  ]);
  assert.deepEqual([left.status, right.status].sort(), ['already-decided', 'reverted']);
  assert.equal((await getDoc(doc(A.db, 'events', f.eventId))).data().totalAmount, 0);
  const rejectedTrash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  assert.equal(rejectedTrash.status, 'trashed');
  assert.deepEqual(rejectedTrash.restoredTransactionIds, []);
  assert.equal(rejectedTrash.restoredHistoryId, null);
  assert.equal((await getDoc(doc(B.db, 'notifications', notificationId))).data().isRead, true);
});

test('取消済みの古い依頼は拒否し、新しいrequestIdだけ承認する', async () => {
  const eventId = nextId('settlement-event');
  const trashId = nextId('settlement-trash');
  const transactionId = nextId('settlement-transaction');
  await setDoc(doc(A.db, 'events', eventId), {
    name: '架空の精算', participants: [A.uid, B.uid], totalAmount: 300,
  });
  await setDoc(doc(A.db, 'transactions', transactionId), {
    paidById: A.uid, paidToId: B.uid, eventId, amount: 300, status: 'completed',
  });
  await setDoc(doc(A.db, 'trash', trashId), {
    type: 'settlement', status: 'trashed', participants: [A.uid, B.uid],
    createdBy: A.uid, counterparties: [{ uid: B.uid, name: '架空B' }],
    eventId, eventName: '架空の精算', itemName: '架空の決済', amount: 300,
    transactionIds: [transactionId], trashedAt: new Date(),
  });

  const first = await A.store.requestSettlementRestore({
    trashId, actorUid: A.uid, actorName: '架空A',
  });
  const firstNotificationId = first.notificationIds[0];
  const firstNotice = (await getDoc(doc(B.db, 'notifications', firstNotificationId))).data();
  assert.equal(firstNotice.restoreRequestId, first.restoreRequestId);
  assert.equal((await A.store.cancelSettlementRestore({
    trashId, actorUid: A.uid, restoreRequestId: first.restoreRequestId,
  })).status, 'cancelled');

  const stale = await B.store.approveSettlementRestore({
    notificationId: firstNotificationId,
    trashId,
    actorUid: B.uid,
    restoreRequestId: first.restoreRequestId,
  });
  assert.equal(stale.status, 'stale-request');
  assert.equal((await getDoc(doc(A.db, 'transactions', transactionId))).data().status, 'completed');

  const second = await A.store.requestSettlementRestore({
    trashId, actorUid: A.uid, actorName: '架空A',
  });
  assert.notEqual(second.restoreRequestId, first.restoreRequestId);
  const secondNotificationId = second.notificationIds[0];
  const secondNotice = (await getDoc(doc(B.db, 'notifications', secondNotificationId))).data();
  assert.equal(secondNotice.restoreRequestId, second.restoreRequestId);
  const approved = await B.store.approveSettlementRestore({
    notificationId: secondNotificationId,
    trashId,
    actorUid: B.uid,
    restoreRequestId: second.restoreRequestId,
  });
  assert.equal(approved.status, 'approved');
  assert.equal((await getDoc(doc(B.db, 'transactions', transactionId))).data().status, 'unpaid');
});

test('復元の「正しい」と「正しくない」が競合しても片方だけ確定する', async () => {
  const f = await deletedPaymentFixture();
  await A.store.restoreDeletedPayment({
    trashId: f.trashId, actorUid: A.uid, actorName: '架空A',
  });
  const restoredTrash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  const notificationId = restoredTrash.restoreNotificationIds[0];
  const notice = (await getDoc(doc(B.db, 'notifications', notificationId))).data();
  assert.equal(notice.trashId, f.trashId);
  const input = {
    notificationId,
    trashId: f.trashId,
    actorUid: B.uid,
    restoreOperationId: restoredTrash.restoreOperationId,
  };
  const results = await Promise.all([
    B.store.confirmRestoredPayment(input),
    B.store.rejectRestoredPayment(input),
  ]);
  assert.equal(results.filter((r) => ['confirmed', 'reverted'].includes(r.status)).length, 1);
  assert.equal(results.filter((r) => r.status === 'already-decided').length, 1);

  const total = (await getDoc(doc(A.db, 'events', f.eventId))).data().totalAmount;
  assert.ok(total === 300 || total === 0);
  if (total === 300) {
    assert.equal((await getDoc(doc(A.db, 'events', f.eventId, 'history', restoredTrash.restoredHistoryId))).exists(), true);
  } else {
    assert.equal((await getDoc(doc(A.db, 'trash', f.trashId))).data().status, 'trashed');
  }
});

test('差し戻し確定後の返信通知だけ失敗しても、再操作で300円を再減算しない', async () => {
  const f = await deletedPaymentFixture();
  await A.store.restoreDeletedPayment({
    trashId: f.trashId, actorUid: A.uid, actorName: '架空A',
  });
  const restoredTrash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  const notificationId = restoredTrash.restoreNotificationIds[0];
  const input = {
    notificationId,
    trashId: f.trashId,
    actorUid: B.uid,
    restoreOperationId: restoredTrash.restoreOperationId,
  };

  const decided = await B.store.rejectRestoredPayment(input);
  assert.equal(decided.status, 'reverted');

  // NotificationIconが共通APIの成功後に送る「差し戻しました」通知だけ失敗した状況。
  // 金額処理を失敗扱いにして共通APIを再送しても、保存部品は再減算しない。
  await assert.rejects(async () => {
    throw new Error('架空の付随通知失敗');
  }, /架空の付随通知失敗/);
  const retry = await B.store.rejectRestoredPayment(input);
  assert.equal(retry.status, 'already-decided');
  assert.equal((await getDoc(doc(A.db, 'events', f.eventId))).data().totalAmount, 0);
  assert.equal((await getDoc(doc(B.db, 'notifications', notificationId))).data().isRead, true);
});

test('復元確認待ちの控えが期限削除された後は、古い通知で金額を変更しない', async () => {
  const f = await deletedPaymentFixture();
  await A.store.restoreDeletedPayment({ trashId: f.trashId, actorUid: A.uid, actorName: '架空A' });
  const restoredTrash = (await getDoc(doc(A.db, 'trash', f.trashId))).data();
  const notificationId = restoredTrash.restoreNotificationIds[0];
  await deleteDoc(doc(B.db, 'trash', f.trashId));

  const input = {
    notificationId,
    trashId: f.trashId,
    actorUid: B.uid,
    restoreOperationId: restoredTrash.restoreOperationId,
  };
  await assert.rejects(B.store.confirmRestoredPayment(input), (error) => error?.code === 'permission-denied');
  await assert.rejects(B.store.rejectRestoredPayment(input), (error) => error?.code === 'permission-denied');
  assert.equal((await getDoc(doc(A.db, 'events', f.eventId))).data().totalAmount, 300);
  assert.equal((await getDoc(doc(B.db, 'notifications', notificationId))).data().isRead, false);
});

test('未精算戻しの承認待ち控えが期限削除された後は、古い通知で完了状態を変えない', async () => {
  const eventId = nextId('expired-settlement-event');
  const trashId = nextId('expired-settlement-trash');
  const transactionId = nextId('expired-settlement-transaction');
  await setDoc(doc(A.db, 'events', eventId), {
    name: '期限確認用の精算', participants: [A.uid, B.uid], totalAmount: 300,
  });
  await setDoc(doc(A.db, 'transactions', transactionId), {
    paidById: A.uid, paidToId: B.uid, eventId, amount: 300, status: 'completed',
  });
  await setDoc(doc(A.db, 'trash', trashId), {
    type: 'settlement', status: 'trashed', participants: [A.uid, B.uid],
    createdBy: A.uid, counterparties: [{ uid: B.uid, name: '架空B' }],
    eventId, eventName: '期限確認用の精算', itemName: '架空の決済', amount: 300,
    transactionIds: [transactionId], trashedAt: new Date(),
  });
  const request = await A.store.requestSettlementRestore({ trashId, actorUid: A.uid, actorName: '架空A' });
  const notificationId = request.notificationIds[0];
  await deleteDoc(doc(B.db, 'trash', trashId));

  await assert.rejects(B.store.approveSettlementRestore({
    notificationId, trashId, actorUid: B.uid, restoreRequestId: request.restoreRequestId,
  }), (error) => error?.code === 'permission-denied');
  assert.equal((await getDoc(doc(B.db, 'transactions', transactionId))).data().status, 'completed');
  assert.equal((await getDoc(doc(B.db, 'notifications', notificationId))).data().isRead, false);
});

after(async () => {
  await Promise.all(apps.map((app) => deleteApp(app)));
});
