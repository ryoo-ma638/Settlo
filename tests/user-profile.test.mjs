// ログインした人の users/{uid} を用意する判断のテスト。
// ここを間違えると「名前が読み込み中のまま」「あとから変えた名前が戻る」が起きる。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildNewUserProfile, shouldCreateUserProfile } from '../src/lib/userProfile.js';

const user = { uid: 'u1', displayName: '大崎', email: 'a@example.com', photoURL: 'https://x/y.png' };

test('まだ無い人の分だけ作る', () => {
  assert.equal(shouldCreateUserProfile(user, false), true);
});

test('すでにある人は触らない（名前を上書きしない）', () => {
  assert.equal(shouldCreateUserProfile(user, true), false);
});

test('匿名のゲストは対象外（setupGuestDemo が作る）', () => {
  assert.equal(shouldCreateUserProfile({ ...user, isAnonymous: true }, false), false);
});

test('uid が無いときは作らない', () => {
  assert.equal(shouldCreateUserProfile({}, false), false);
  assert.equal(shouldCreateUserProfile(null, false), false);
});

test('画像は photo と photoURL の両方に入れる（読むキーが画面で違う）', () => {
  const d = buildNewUserProfile(user);
  assert.equal(d.photo, 'https://x/y.png');
  assert.equal(d.photoURL, 'https://x/y.png');
  assert.equal(d.name, '大崎');
  assert.equal(d.uid, 'u1');
});

test('名前が無い人でも空にはしない', () => {
  assert.equal(buildNewUserProfile({ uid: 'u2' }).name, '名前なし');
});

test('連絡先（email）は users に入れない', () => {
  // users は他の人からも1件ずつ読める。アプリも保存済みの email を使っていない。
  const d = buildNewUserProfile(user);
  assert.equal('email' in d, false, 'email を入れてはいけない');
});

test('ログイン直後に用意し、届かない /api は呼ばない', () => {
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
  assert.match(app, /ensureUserProfile\(user\)/);
  assert.match(app, /shouldCreateUserProfile/);
  const mypage = readFileSync(new URL('../src/views/MyPageView.vue', import.meta.url), 'utf8');
  // 本番に /api は無い（Hosting の書き換えで index.html が返るだけ）。
  // 説明のコメントには出てくるので、呼び出しそのものが無いことを見る。
  assert.ok(!/api\.post\(/.test(mypage), 'MyPage から /api を呼んではいけない');
  assert.ok(!/^import api from/m.test(mypage), '使わない api の読み込みを残さない');
});
