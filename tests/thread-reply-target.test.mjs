import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/views/ThreadView.vue', 'utf8');
const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

test('返信の下書きとAIは、グループのチャットでも使える', () => {
  // 以前は URL に tx が付いた1対1のチャットでしか出なかった。
  // 支払いのグループチャットが本流なので、そこで使えないと機能が無いのと同じ。
  assert.match(code, /v-if="replyTx"/, '下書きの出し分けが取引だけを見ている');
  assert.match(code, /transactionId: replyTxId\.value/, 'AIへ渡す取引が URL 依存のまま');
  assert.ok(!/if \(!txId \|\| aiLoading/.test(code), 'AIの入口が URL の tx を必須にしている');
});

test('グループでは、自分が当事者の取引を選ぶ', () => {
  assert.match(code, /paidById === myUid \|\| t\.paidToId === myUid/, '自分の1件を選んでいない');
});

test('取引の一覧より後で組み立てる（読み込み順で落ちないように）', () => {
  const list = code.indexOf('const payTxs = ref(');
  const pick = code.indexOf('const myTx = computed(');
  assert.ok(list !== -1 && pick !== -1, '目印が見つからない');
  assert.ok(list < pick, 'payTxs より前で myTx を組み立てている');
});

test('承認・拒否のバーは1対1のままにする', () => {
  // グループで承認できてしまうと、誰の分を承認したのか分からなくなる
  assert.match(code, /canApprove = computed\(\(\) => !isGroup\.value/);
});

test('グループの取引は1件ずつ購読する（1件読めなくても止まらない）', () => {
  // まとめて引くと、読めない取引が1件でもあると全部返ってこなくなり、
  // 割り勘の内訳も返信の下書きも出なくなる。
  assert.match(code, /ids\.map\(\(id\) => onSnapshot\(doc\(db, 'transactions', id\)/, '1件ずつ購読していない');
  assert.match(code, /rows\.delete\(id\); apply\(rows\)/, '読めなかった分を飛ばしていない');
});

test('返信の下書きは、AIを使うものだと分かる名前にする', () => {
  // 「返信を考える」だけだと、AIが文案を出すことが押す前に伝わらない
  assert.match(source, /AIと返信を考える/, '名前にAIが入っていない');
});
