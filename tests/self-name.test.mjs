// 「あなた」「自分」は相手の画面に出してはいけない。
// 古いデータに保存されているので、出すときと書くときの両方で弾く。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { isSelfName, displayName } from '../src/lib/selfName.js';

const read = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('一人称と空は名前として使わない', () => {
  for (const w of ['あなた', '自分', 'me', 'You', 'you', '', null, undefined, '  自分  ']) {
    assert.equal(isSelfName(w), true, `${w} は弾く`);
  }
});

test('ふつうの名前はそのまま使う', () => {
  for (const w of ['デモ太郎', 'ゲスト567', 'あなたの友人']) {
    assert.equal(isSelfName(w), false, `${w} は通す`);
  }
  assert.equal(displayName('デモ太郎'), 'デモ太郎');
});

test('使えない名前は代わりの言葉になる', () => {
  assert.equal(displayName('あなた'), '相手');
  assert.equal(displayName(''), '相手');
  assert.equal(displayName(null, 'メンバー'), 'メンバー');
});

test('相談の一覧は、保存された名前をそのまま出さない', () => {
  // ここを直に出していたので「相手：あなた」と表示されていた
  const list = read('views/ChatListView.vue');
  assert.match(list, /displayName\(t\.participantNames/);
  const person = read('views/PersonChatsView.vue');
  assert.match(person, /isSelfName\(stored\)/);
});

test('保存するときにも一人称を入れない', () => {
  const save = read('lib/batchPaymentSave.js');
  assert.match(save, /isSelfName\(participantNames\[uid\]\)/);
});

test('件名が「のお支払いの件」だけにならない', () => {
  const src = read('lib/thread.js');
  const body = src.match(/export function subjectLabel[\s\S]*?\n}/)[0];
  const subjectLabel = new Function('return ' + body.replace('export function', 'function'))();
  assert.equal(subjectLabel({ type: 'payment_reminder' }), 'お支払いの件');
  assert.equal(subjectLabel({ type: 'payment_completed' }), '精算の件');
  assert.equal(
    subjectLabel({ type: 'payment_reminder', itemName: 'ジンギスカン夕食', amount: 2000 }),
    '「ジンギスカン夕食」（¥2,000）のお支払いの件'
  );
});

test('画面に出る文から「ゴミ箱」を無くす（画面名は「取引を元に戻す」）', () => {
  // 見る対象は「利用者の目に入る文」だけ。
  // コメント（// 以降）と、開発者向けの console.* は対象外にする。
  const userFacing = (src) => src
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .filter((line) => !/console\.\s*\w+\(/.test(line))
    .join('\n');
  const files = ['components/NotificationIcon.vue', 'views/EventDetails.vue', 'views/HomeView.vue', 'views/TrashView.vue'];
  for (const f of files) {
    const hits = userFacing(read(f)).split('\n').filter((l) => l.includes('ゴミ箱'));
    assert.deepEqual(hits, [], `${f} に画面へ出る「ゴミ箱」が残っている`);
  }
});

test('同じ相手に受け取りと支払いの両方があるとき、額面と差し引きの違いを説明する', () => {
  // 未払い ¥3,000 なのに「まとめて」は ¥1,000。どちらが本当か分からなくなるので、
  // 違いが出る相手がいるときだけ理由を出し、「まとめて」への入口を添える。
  const money = read('views/MoneyPage.vue');
  assert.match(money, /offsettablePeople/);
  assert.match(money, /\(m\.receive \|\| 0\) > 0 && \(m\.pay \|\| 0\) > 0/);
  // お支払い待ちと未払いの両方に出す（片方だけだと、もう片方で同じ疑問が残る）
  assert.equal((money.match(/class="offset-hint"/g) || []).length, 2);
});

test('復元の控えは、相手の確認待ちなら7日を過ぎても消さない', () => {
  const fn = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  const purge = fn.match(/exports\.purgeTrash[\s\S]*?\n\);/)[0];
  assert.match(purge, /status === "pending" \|\| status === "restored"/);
  assert.match(purge, /continue;/);
});

test('控えの自動削除が、無いインデックスを要求しない', () => {
  // collectionGroup + where("trashedAt") は COLLECTION_GROUP インデックスが要る。
  // 無いまま毎日 FAILED_PRECONDITION で落ちていて、1件も消えていなかった。
  const fn = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  // コメントには昔の書き方が説明として残っているので、実行される行だけを見る
  const purge = fn.match(/exports\.purgeTrash[\s\S]*?\n\);/)[0]
    .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/collectionGroup\("trash"\)\s*\.where/.test(purge), 'where で絞るとインデックスが要る');
  assert.match(purge, /collectionGroup\("trash"\)\.get\(\)/);
  // 絞り込みは JavaScript 側
  assert.match(purge, /trashedMs >= cutoffMs/);
  // 最後の端数もコミットする（400件ちょうどでないと消えない、を防ぐ）
  assert.match(purge, /if \(count % 400 !== 0\) await batch\.commit\(\);/);
});

test('ログインのたびに名前を上書きしない', () => {
  // 以前は毎回 Googleの表示名で上書きしていたので、ニックネームがログインのたびに戻っていた
  const user = read('user.js');
  assert.match(user, /if \(!data\.name\)/);
  assert.ok(!/name: user\.displayName \|\| "名前なし",\s*\n\s*email/.test(user), '毎回 name を書いてはいけない');
});

test('未払いが残っているのに「全部片付いています」と言わない', () => {
  // ホームの枠が見ているのは承認待ち・要確認・イベントで精算中の3行だけで、
  // ふつうの未払いは入っていない。残っているのに終わったように読ませない。
  // 何を出すかの判断は paymentOverview.js の nextStepOf にある（状態ごとの確認は
  // tests/home-next-step.test.mjs）。ここでは画面がそれを使っていることだけ見る。
  const carousel = read('components/PaymentCarousel.vue');
  assert.match(carousel, /nextStepOf\(props\.overview\)/);
  assert.match(carousel, /\{\{ nextStep\.title \}\}/);
  assert.ok(!/いまは全部片付いています/.test(carousel), '文面は nextStepOf 側に集約する');
});
