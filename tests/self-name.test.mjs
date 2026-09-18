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
