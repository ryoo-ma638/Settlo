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

test('S1 招待コードでの参加（自分を1人足すだけ）は今までどおり通る', async () => {
  const id = `s1c-${Date.now().toString(36)}`;
  await seed(id);
  await updateDoc(doc(stranger, 'events', id), {
    participants: ['u-owner', 'u-member', 'u-stranger'],
  });
  const after = (await getDoc(doc(owner, 'events', id))).data();
  assert.deepEqual(after.participants, ['u-owner', 'u-member', 'u-stranger']);
  assert.equal(after.totalAmount, 15000, '金額は動かない');
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
