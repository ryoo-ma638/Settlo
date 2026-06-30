/* =========================================================
   Settlo テストデータ投入スクリプト（手動実行用・本番Firestore）
   目的：決済フロー（支払い／催促／PayPayリンク／完了で消える）の動作確認。
   実行はあなた自身が行ってください（管理者権限で本番DBに書き込みます）。

   使い方：
     1) firebase-admin が無ければ:  npm i firebase-admin
     2) ユーザー一覧を表示:          node seed-test-data.cjs
     3) 自分とテストユーザーのUIDを確認して投入:
                                     node seed-test-data.cjs <自分のuid> <テストユーザーのuid>
     - 投入データには isTest:true を付けます（後で検索・削除しやすいように）。
     - 後片付け:                     node seed-test-data.cjs cleanup
   ========================================================= */

let admin;
try { admin = require('firebase-admin'); }
catch (e) {
  try { admin = require('./functions/node_modules/firebase-admin'); }
  catch (e2) {
    console.error('firebase-admin が見つかりません。先に `npm i firebase-admin` を実行してください。');
    process.exit(1);
  }
}

const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

const DUMMY_PAYPAY = 'https://qr.paypay.ne.jp/p2p01_settlo_test_dummy';

async function listUsers() {
  const snap = await db.collection('users').get();
  console.log('=== users 一覧（uid / 名前） ===');
  snap.docs.forEach((d) => console.log(d.id, '/', (d.data().name || '(名前なし)')));
  console.log('\n投入する場合: node seed-test-data.cjs <自分のuid> <テストユーザーのuid>');
}

async function seed(myUid, testUid) {
  // A. 自分 → テストユーザー（自分の「未払い」。＝支払いテスト用）
  const a = await db.collection('transactions').add({
    paidById: myUid, paidToId: testUid,
    amount: 1200, status: 'unpaid',
    itemName: 'テスト：ランチ代', eventName: 'テスト精算',
    createdAt: ts(), isTest: true,
  });

  // B. テストユーザー → 自分（自分の「入金待ち」。＝催促テスト用）
  const b = await db.collection('transactions').add({
    paidById: testUid, paidToId: myUid,
    amount: 800, status: 'unpaid',
    itemName: 'テスト：カフェ代', eventName: 'テスト精算',
    createdAt: ts(), isTest: true,
  });

  // C. テストユーザー → 自分 で「承認待ち」（あなたが『承認して完了にする』をテストできる）
  const c = await db.collection('transactions').add({
    paidById: testUid, paidToId: myUid,
    amount: 1500, status: 'awaiting_approval',
    itemName: 'テスト：承認待ち(タクシー代)', eventName: 'テスト精算',
    createdAt: ts(), isTest: true,
  });

  // テストユーザーに仮PayPayリンク（→ あなたの「PayPayで支払う」が有効になる）
  await db.collection('users').doc(testUid).set({ paypayLink: DUMMY_PAYPAY }, { merge: true });

  // D. test1 → 自分への「催促通知」（＝あなたのお知らせベルに『催促が届いた』が出る）
  const tuName = (await db.collection('users').doc(testUid).get()).data()?.name || 'テストユーザー１';
  await db.collection('notifications').add({
    toUserId: myUid, fromUserId: testUid, fromUserName: tuName,
    transactionId: a.id, type: 'payment_reminder',
    message: '支払いの催促が届きました（至急・¥1,200）',
    isRead: false, createdAt: ts(), isTest: true,
  });

  // フレンド関係も作成
  await addFriend(myUid, testUid);

  console.log('✅ テストデータ投入完了');
  console.log('  - 未払い(支払いテスト)   transaction:', a.id, '¥1,200');
  console.log('  - 入金待ち(催促テスト)   transaction:', b.id, '¥800');
  console.log('  - 承認待ち(承認テスト)   transaction:', c.id, '¥1,500');
  console.log('  - 受け取った催促通知（お知らせベルに表示）を1件作成');
  console.log('  - テストユーザーに仮PayPayリンクを設定:', DUMMY_PAYPAY);
  console.log('  - フレンド関係を作成（フレンド一覧に表示されます）');
  console.log('\nアプリで「お支払い」タブを開いて動作確認してください。');
  console.log('完了/承認すると status が completed になり、未払い/入金待ち一覧から消えます。');
}

// フレンド関係（双方向）を作成
async function addFriend(myUid, testUid) {
  const tu = (await db.collection('users').doc(testUid).get()).data() || {};
  const me = (await db.collection('users').doc(myUid).get()).data() || {};
  await db.collection('users').doc(myUid).collection('friends').doc(testUid).set({
    uid: testUid, name: tu.name || 'テストユーザー', photo: tu.photo || tu.photoURL || '',
    isFriend: true, isTrading: true, tradeCount: 0, addedAt: ts(), isTest: true,
  }, { merge: true });
  await db.collection('users').doc(testUid).collection('friends').doc(myUid).set({
    uid: myUid, name: me.name || '自分', photo: me.photo || me.photoURL || '',
    isFriend: true, isTrading: true, tradeCount: 0, addedAt: ts(), isTest: true,
  }, { merge: true });
  console.log('✅ フレンド関係を作成しました（フレンド一覧に表示されます）');
}

// 指定UIDが関わる取引を状態つきで一覧（読み取り専用の診断用）
async function listTx(uid) {
  const me = (await db.collection('users').doc(uid).get());
  console.log('=== 診断対象 uid ===');
  console.log(uid, '/', me.exists ? (me.data().name || '(名前なし)') : '★usersドキュメントが存在しません★');

  const all = await db.collection('transactions').get();
  const mine = all.docs.filter((d) => {
    const x = d.data();
    return x.paidById === uid || x.paidToId === uid;
  });
  console.log(`\n=== この uid が関わる transactions: ${mine.length} 件 ===`);
  if (mine.length === 0) {
    console.log('（0件。アプリでログイン中のUIDと、この uid が一致しているか確認してください）');
  }
  mine.forEach((d) => {
    const x = d.data();
    const role = x.paidById === uid ? '支払う側(未払い)' : '受け取る側(入金待ち)';
    const bad = (!x.paidById || !x.paidToId) ? '  ⚠️不正(相手ID欠落)' : '';
    console.log(
      `- ¥${x.amount}  status=${x.status}  ${role}  payById=${x.paidById || '∅'} → payToId=${x.paidToId || '∅'}  [${x.itemName || ''}]  id=${d.id}${bad}`
    );
  });
  console.log('\nヒント: 未払いタブには paidById がこの uid の「completed以外」が出ます。');
}

// 相手IDが欠落した不正な transactions だけを削除
async function cleanBad() {
  const snap = await db.collection('transactions').get();
  let n = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (!x.paidById || !x.paidToId) { await d.ref.delete(); n++; console.log('削除:', d.id, `[${x.itemName || ''}]`); }
  }
  console.log(`🧹 相手ID欠落の不正 transactions を ${n} 件削除しました。`);
}

async function cleanup() {
  const snap = await db.collection('transactions').where('isTest', '==', true).get();
  let n = 0;
  for (const d of snap.docs) { await d.ref.delete(); n++; }
  // テスト用の通知も削除
  const nsnap = await db.collection('notifications').where('isTest', '==', true).get();
  let m = 0;
  for (const d of nsnap.docs) { await d.ref.delete(); m++; }
  console.log(`🧹 テスト用 transactions を ${n} 件、通知を ${m} 件削除しました。`);
  console.log('（テストユーザーの paypayLink は必要に応じて手動で消してください）');
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'cleanup') { await cleanup(); return; }
  if (args[0] === 'cleanbad') { await cleanBad(); return; }
  if (args[0] === 'tx') {
    if (args.length < 2) { console.log('使い方: node seed-test-data.cjs tx <自分のuid>'); return; }
    await listTx(args[1]); return;
  }
  if (args[0] === 'friend') {
    if (args.length < 3) { console.log('使い方: node seed-test-data.cjs friend <自分のuid> <テストユーザーのuid>'); return; }
    await addFriend(args[1], args[2]); return;
  }
  if (args.length < 2) { await listUsers(); return; }
  await seed(args[0], args[1]);
}

main().then(() => process.exit(0)).catch((e) => { console.error('エラー:', e.message || e); process.exit(1); });
