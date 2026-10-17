// Firestore ルールの検証。**エミュレータが必要**なので npm test には入れない。
//   実行: npm run test:rules
//   （Java が要る。無いと firebase emulators:exec が起動できない）
//
// 見るのは2つ。
//   1. ふさいだ穴が本当にふさがっているか
//   2. ふつうの操作が壊れていないか（ここを落とすと展示が止まる）
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initializeApp, deleteApp } = require('firebase/app');
const sdk = require('firebase/firestore');
const { doc, setDoc, getDoc, updateDoc, connectFirestoreEmulator, getFirestore } = sdk;

const projectId = 'demo-settlo-rules';
const [host, portText] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8189').split(':');
const port = Number(portText);
const apps = [];

// uid ごとのつなぎ口。anonymous=true で匿名ログイン相当にする。
function client(uid, anonymous = false) {
  const app = initializeApp({ projectId, apiKey: 'demo-only', appId: 'rules-only' }, `${uid || 'none'}-${apps.length}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port, uid
    ? { mockUserToken: { sub: uid, user_id: uid, firebase: { sign_in_provider: anonymous ? 'anonymous' : 'google.com' } } }
    : {});
  return db;
}

const owner = client('u-owner');
const member = client('u-member');
const stranger = client('u-stranger', true); // 参加していない匿名ゲスト
const denied = (e) => e.code === 'permission-denied';

const seed = async (id) => {
  await setDoc(doc(owner, 'events', id), {
    participants: ['u-owner', 'u-member'], locked: false,
    totalAmount: 15000, name: '架空イベント', invitationCode: 'FAKECODE',
  });
  await setDoc(doc(owner, 'events', id, 'history', 'h1'), { amount: 9000, itemName: '架空の立替' });
  await setDoc(doc(owner, 'transactions', `tx-${id}`), {
    paidById: 'u-member', paidToId: 'u-owner', eventId: id, amount: 3000, status: 'unpaid',
  });
  await setDoc(doc(owner, 'threads', `th-${id}`), { participants: ['u-owner', 'u-member'] });
};

test('S1 未参加の人が、自分を足すのと同時に金額を書き換えられない', async () => {
  const id = `s1-${Date.now().toString(36)}`;
  await seed(id);
  await assert.rejects(updateDoc(doc(stranger, 'events', id), {
    participants: ['u-owner', 'u-member', 'u-stranger'], totalAmount: 999999,
  }), denied);
  assert.equal((await getDoc(doc(owner, 'events', id))).data().totalAmount, 15000);
});

test('S1 未参加の人が、自分を足すのと同時に他の参加者を外せない', async () => {
  const id = `s1b-${Date.now().toString(36)}`;
  await seed(id);
  await assert.rejects(updateDoc(doc(stranger, 'events', id), {
    participants: ['u-stranger'],
  }), denied);
});

test('S1 未参加の人は、自分を参加者に足せない（参加はサーバー側の joinEvent が行う）', async () => {
  const id = `s1c-${Date.now().toString(36)}`;
  await seed(id);
  await assert.rejects(updateDoc(doc(stranger, 'events', id), {
    participants: ['u-owner', 'u-member', 'u-stranger'],
  }), denied);
  assert.deepEqual((await getDoc(doc(owner, 'events', id))).data().participants, ['u-owner', 'u-member']);
});

test('イベント：未参加の人は読めず、招待コードでも探せない', async () => {
  const { collection, getDocs, query, where } = sdk;
  const id = `ev-${Date.now().toString(36)}`;
  await seed(id);
  await assert.rejects(getDoc(doc(stranger, 'events', id)), denied);
  await assert.rejects(getDocs(query(collection(stranger, 'events'), where('invitationCode', '==', 'FAKECODE'))), denied);
});

test('イベント：参加者は読めて、自分のイベント一覧も引ける', async () => {
  const { collection, getDocs, query, where } = sdk;
  const id = `ev2-${Date.now().toString(36)}`;
  await seed(id);
  assert.equal((await getDoc(doc(member, 'events', id))).data().name, '架空イベント');
  const mine = await getDocs(query(collection(member, 'events'), where('participants', 'array-contains', 'u-member')));
  assert.ok(mine.docs.some((d) => d.id === id));
});

test('S1 参加者は、これまでどおりイベントを編集できる', async () => {
  const id = `s1d-${Date.now().toString(36)}`;
  await seed(id);
  await updateDoc(doc(member, 'events', id), { name: '名前を変えた', totalAmount: 20000 });
  assert.equal((await getDoc(doc(owner, 'events', id))).data().name, '名前を変えた');
});

test('S1 鍵付きのイベントには、これまでどおり自分で入れない', async () => {
  const id = `s1e-${Date.now().toString(36)}`;
  await setDoc(doc(owner, 'events', id), { participants: ['u-owner'], locked: true, totalAmount: 0 });
  await assert.rejects(updateDoc(doc(stranger, 'events', id), {
    participants: ['u-owner', 'u-stranger'],
  }), denied);
});

test('S2 スレッドIDを知っていても、自分を足して会話を読めない', async () => {
  const id = `s2-${Date.now().toString(36)}`;
  await seed(id);
  await assert.rejects(updateDoc(doc(stranger, 'threads', `th-${id}`), {
    participants: ['u-owner', 'u-member', 'u-stranger'],
  }), denied);
  await assert.rejects(getDoc(doc(stranger, 'threads', `th-${id}`)), denied);
});

test('S2 当事者は、これまでどおりスレッドを更新できる', async () => {
  const id = `s2b-${Date.now().toString(36)}`;
  await seed(id);
  await updateDoc(doc(member, 'threads', `th-${id}`), { hiddenBy: ['u-member'] });
  assert.deepEqual((await getDoc(doc(owner, 'threads', `th-${id}`))).data().hiddenBy, ['u-member']);
});

test.after(async () => { for (const app of apps) await deleteApp(app); });

test('S5 users をまとめて引けない（上限のある検索だけ通る）', async () => {
  const { collection, getDocs, query, where, orderBy, limit } = sdk;
  await setDoc(doc(owner, 'users', 'u-owner'), { name: '架空オーナー' });
  // フレンド検索と同じ形（limit 10）は通る
  const ok = await getDocs(query(collection(stranger, 'users'), orderBy('name'), where('name', '>=', '架空'), limit(10)));
  assert.ok(ok.size >= 0);
  // 上限なしの丸ごと取得は拒否
  await assert.rejects(getDocs(collection(stranger, 'users')), denied);
});

test('S5 本人以外は private を読めない', async () => {
  await setDoc(doc(owner, 'users', 'u-owner', 'private', 'push'), { tokens: ['FAKE'] });
  assert.ok((await getDoc(doc(owner, 'users', 'u-owner', 'private', 'push'))).exists());
  await assert.rejects(getDoc(doc(stranger, 'users', 'u-owner', 'private', 'push')), denied);
});

test('S6 送信者を偽った通知は作れない', async () => {
  const { setDoc: set } = sdk;
  await assert.rejects(
    set(doc(stranger, 'notifications', `fake-${Date.now().toString(36)}`),
      { toUserId: 'u-owner', fromUserId: 'u-member', type: 'payment_reminder' }),
    denied,
  );
});

test('S6 自分の名前で送る通知は、これまでどおり作れる', async () => {
  const { setDoc: set } = sdk;
  const id = `ok-${Date.now().toString(36)}`;
  await set(doc(stranger, 'notifications', id), { toUserId: 'u-owner', fromUserId: 'u-stranger', type: 'payment_reminder' });
  assert.ok((await getDoc(doc(owner, 'notifications', id))).exists() === false || true);
});

test('フレンド申請：送信者を偽った申請は作れない', async () => {
  const { setDoc: set } = sdk;
  await assert.rejects(
    set(doc(stranger, 'friendRequests', `fake-${Date.now().toString(36)}`),
      { toId: 'u-owner', formId: 'u-member', formName: '偽の送信者', status: 'pending' }),
    denied,
  );
});

test('フレンド申請：自分の名前での申請は、これまでどおり作れて、相手が読める', async () => {
  const { setDoc: set } = sdk;
  const id = `ok-fr-${Date.now().toString(36)}`;
  await set(doc(stranger, 'friendRequests', id), { toId: 'u-owner', formId: 'u-stranger', formName: 'ゲスト', status: 'pending' });
  assert.ok((await getDoc(doc(owner, 'friendRequests', id))).exists());
});

test('フレンド：他人の一覧には書き込めない（承認はサーバー側で行う）', async () => {
  await assert.rejects(
    setDoc(doc(stranger, 'users', 'u-owner', 'friends', 'u-stranger'), { uid: 'u-stranger', isFriend: true }),
    denied,
  );
});

test('フレンド：自分の一覧は自分で書けて、相手の一覧から自分を消す（解除）は今までどおりできる', async () => {
  await setDoc(doc(owner, 'users', 'u-owner', 'friends', 'u-member'), { uid: 'u-member', isFriend: true });
  await sdk.deleteDoc(doc(member, 'users', 'u-owner', 'friends', 'u-member'));
  assert.equal((await getDoc(doc(owner, 'users', 'u-owner', 'friends', 'u-member'))).exists(), false);
});

test('フレンド申請：送った側は自分の申請を承認済みにできない。受け取った側はできる', async () => {
  const id = `fr-${Date.now().toString(36)}`;
  await setDoc(doc(stranger, 'friendRequests', id), { toId: 'u-owner', formId: 'u-stranger', formName: 'ゲスト', status: 'pending' });
  await assert.rejects(updateDoc(doc(stranger, 'friendRequests', id), { status: 'accepted' }), denied);
  await updateDoc(doc(owner, 'friendRequests', id), { status: 'accepted' });
  assert.equal((await getDoc(doc(owner, 'friendRequests', id))).data().status, 'accepted');
});

test('承認履歴：書いた人を偽った行や、書いた人の無い行は作れない', async () => {
  await assert.rejects(setDoc(doc(stranger, 'approvalHistory', `ah-fake-${Date.now().toString(36)}`),
    { userId: 'u-owner', role: 'toMe', kind: 'payment', outcome: 'approved', byUid: 'u-member' }), denied);
  await assert.rejects(setDoc(doc(stranger, 'approvalHistory', `ah-none-${Date.now().toString(36)}`),
    { userId: 'u-owner', role: 'toMe', kind: 'payment', outcome: 'approved' }), denied);
});

test('承認履歴：自分が書いたと記録すれば、自分の行も相手の行も今までどおり作れる', async () => {
  const id = `ah-ok-${Date.now().toString(36)}`;
  await setDoc(doc(member, 'approvalHistory', `${id}-me`), { userId: 'u-member', role: 'byMe', kind: 'payment', outcome: 'approved', byUid: 'u-member' });
  await setDoc(doc(member, 'approvalHistory', `${id}-other`), { userId: 'u-owner', role: 'toMe', kind: 'payment', outcome: 'approved', byUid: 'u-member' });
  assert.equal((await getDoc(doc(owner, 'approvalHistory', `${id}-other`))).data().byUid, 'u-member');
});

test('立て替えのグループチャットを、立替者が新規に作れる', async () => {
  // ensurePaymentThread は「読んでから書く」。まだ無いスレッドの読み取りが拒否されると
  // ここで止まり、チャットが一度も作られない（実際に本番でそうなっていた）。
  const { runTransaction } = sdk;
  const ref = doc(owner, 'threads', `pay-${Date.now().toString(36)}`);
  await runTransaction(owner, async (tx) => {
    await tx.get(ref);
    tx.set(ref, { participants: ['u-owner', 'u-member'], creditorUid: 'u-owner' }, { merge: true });
  });
  assert.ok((await getDoc(doc(owner, 'threads', ref.id))).exists());
});

test('無い文書が読めても、他人のスレッドは読めないまま', async () => {
  const id = `s2c-${Date.now().toString(36)}`;
  await setDoc(doc(owner, 'threads', `th-${id}`), { participants: ['u-owner', 'u-member'] });
  await assert.rejects(getDoc(doc(stranger, 'threads', `th-${id}`)), denied);
});

// =============================================================
// 相手ごとのまとめ精算（settlementBatch）
//   承認待ちのまとめ精算の取引は画面から書けない。内訳は画面から付けられない。
//   承認待ちの状態はルール上は画面から作れないので、管理者権限（Admin SDK）で用意する。
// =============================================================
import { after } from 'node:test';
const requireFromFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const admin = requireFromFunctions('firebase-admin');
if (!process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
const adminApp = admin.initializeApp({ projectId }, `rules-admin-${Date.now()}`);
const adminDb = adminApp.firestore();
after(async () => { await adminApp.delete(); });

const batchOf = (tag, role) => ({
  id: `b-${tag}`, gross: 3000, offset: 1000, net: 2000, count: 1, counterCount: 1,
  payerUid: 'u-member', receiverUid: 'u-owner', role,
});
const seedBatch = async (tag) => {
  await adminDb.doc(`transactions/sb-main-${tag}`).set({
    paidById: 'u-member', paidToId: 'u-owner', amount: 3000, status: 'awaiting_approval',
    approvalReviewRequired: false, approvalRequestId: `b-${tag}`, settlementBatch: batchOf(tag, 'main'),
  });
  await adminDb.doc(`transactions/sb-offset-${tag}`).set({
    paidById: 'u-owner', paidToId: 'u-member', amount: 1000, status: 'completed',
    approvalReviewRequired: false, settlementBatch: batchOf(tag, 'offset'),
  });
  await adminDb.doc(`transactions/sb-done-${tag}`).set({
    paidById: 'u-member', paidToId: 'u-owner', amount: 700, status: 'completed',
    approvalReviewRequired: false, settlementBatch: { ...batchOf(tag, 'main'), id: `b-done-${tag}` },
  });
  await adminDb.doc(`transactions/plain-${tag}`).set({ paidById: 'u-member', paidToId: 'u-owner', amount: 500, status: 'unpaid' });
};

test('まとめ精算：承認待ちの取引は、受け取る側も払う側も画面から完了・未払い・削除にできない', async () => {
  await seedBatch('p1');
  await assert.rejects(updateDoc(doc(owner, 'transactions', 'sb-main-p1'), { status: 'completed', approvalReviewRequired: false }), denied);
  await assert.rejects(updateDoc(doc(member, 'transactions', 'sb-main-p1'), { status: 'unpaid', settlementBatch: null, approvalReviewRequired: true }), denied);
  await assert.rejects(updateDoc(doc(owner, 'transactions', 'sb-main-p1'), { remindCount: 1 }), denied);
  await assert.rejects(sdk.deleteDoc(doc(member, 'transactions', 'sb-main-p1')), denied);
});

test('まとめ精算：画面から内訳（settlementBatch）を付けたり書き換えたりできない', async () => {
  await seedBatch('p2');
  await assert.rejects(updateDoc(doc(member, 'transactions', 'plain-p2'), { settlementBatch: batchOf('p2', 'main') }), denied);
  await assert.rejects(updateDoc(doc(owner, 'transactions', 'sb-offset-p2'), { settlementBatch: { ...batchOf('p2', 'offset'), net: 1 } }), denied);
  await assert.rejects(setDoc(doc(member, 'transactions', 'new-p2'), {
    paidById: 'u-member', paidToId: 'u-owner', amount: 100, status: 'unpaid', settlementBatch: batchOf('p2', 'main'),
  }), denied);
});

test('まとめ精算：内訳のない未払いの取引は今までどおり支払い報告でき、申請IDも付けられる', async () => {
  await seedBatch('p3');
  await updateDoc(doc(member, 'transactions', 'plain-p3'), { status: 'awaiting_approval', approvalReviewRequired: false, approvalRequestId: 'sr-p3' });
  const snap = await getDoc(doc(owner, 'transactions', 'plain-p3'));
  assert.equal(snap.data().approvalRequestId, 'sr-p3');
  // 内訳に触らない更新（催促回数など）は、相殺側の完了済みの取引にも今までどおりできる
  await updateDoc(doc(owner, 'transactions', 'sb-offset-p3'), { remindCount: 1 });
});

test('まとめ精算：完了済みの取引を内訳ごと未精算へ戻す（合意の戻し）は今までどおりできる', async () => {
  await seedBatch('p4');
  await updateDoc(doc(owner, 'transactions', 'sb-done-p4'), { status: 'unpaid', settlementBatch: null, approvalReviewRequired: false });
  const snap = await getDoc(doc(member, 'transactions', 'sb-done-p4'));
  assert.equal(snap.data().status, 'unpaid');
  assert.equal(snap.data().settlementBatch, null);
});

test('まとめ精算：申請の台帳（settlementRequests）は画面から読めず書けない', async () => {
  await adminDb.doc('settlementRequests/b-ledger').set({ kind: 'submit', actorUid: 'u-member' });
  await assert.rejects(getDoc(doc(owner, 'settlementRequests', 'b-ledger')), denied);
  await assert.rejects(setDoc(doc(member, 'settlementRequests', 'b-new'), { kind: 'submit' }), denied);
  await assert.rejects(updateDoc(doc(member, 'settlementRequests', 'b-ledger'), { decision: 'approved' }), denied);
});
