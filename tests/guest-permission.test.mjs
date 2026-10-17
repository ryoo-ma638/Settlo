// ゲスト権限の最小修正（S1〜S4）が、コードに入っているかを見る。
// ルール本体の動きは tests/rules-emulator.test.mjs（要エミュレータ）で確かめている。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const fn = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
// 説明のコメントに昔の書き方が残っているので、実行される行だけを見る
const code = (src) => src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

test('S1 イベントは参加者だけが読み書きし、自分で参加者に入る更新は無い（参加は joinEvent が行う）', () => {
  const r = code(rules);
  // users の中にも trash があるので、events の後ろにある共有ゴミ箱の match を終点にする
  const evStart = r.indexOf('match /events/{eventId}');
  const ev = r.slice(evStart, r.indexOf('match /trash/{trashId}', evStart));
  assert.ok(!/isSelfJoinOnly/.test(r), '自分で参加者に入る更新の抜け道が残っている');
  assert.ok(!/allow read: if isSignedIn\(\);/.test(ev), 'ログインだけで読める形が残っている');
  assert.match(ev, /allow get: if isSignedIn\(\)\s*&& \(resource == null \|\| request\.auth\.uid in resource\.data\.participants\);/);
  assert.match(ev, /allow list: if isSignedIn\(\) && request\.auth\.uid in resource\.data\.participants;/);
  assert.match(ev, /allow update: if isSignedIn\(\)[\s\S]*?&& request\.auth\.uid in resource\.data\.participants;/);
  // 参加はサーバー側。招待が無い人は eventId 指定で入れず、鍵付きはリクエストに回す
  const f = code(fn);
  assert.match(f, /exports\.joinEvent/);
  const core = code(readFileSync(new URL('../functions/joinEventCore.js', import.meta.url), 'utf8'));
  assert.match(core, /event_invite/);
  assert.match(core, /locked/);
});

test('S1 以前の「自分を入れれば何でも書ける」形が残っていない', () => {
  const r = code(rules);
  assert.ok(
    !/request\.auth\.uid in request\.resource\.data\.participants\s*\n?\s*&&\s*resource\.data\.get\('locked'/.test(r),
    '自己追加だけで全項目を書ける条件が残っている',
  );
});

test('S2 スレッドは、すでに参加している人だけが更新できる', () => {
  const r = code(rules);
  const thread = r.slice(r.indexOf('match /threads/{threadId}'));
  assert.match(thread, /allow update: if isSignedIn\(\) && request\.auth\.uid in resource\.data\.participants;/);
  assert.ok(
    !/allow update[\s\S]{0,160}request\.auth\.uid in request\.resource\.data\.participants/.test(thread),
    '自分を足して更新する抜け道が残っている',
  );
});

test('S3 精算の計算は、そのイベントの参加者だけが呼べる', () => {
  const f = code(fn);
  const calc = f.slice(f.indexOf('exports.calculateSettlement'));
  assert.match(calc, /!participants\.includes\(request\.auth\.uid\)/);
  assert.match(calc, /permission-denied/);
});

test('S4 ゲストデモは、匿名でログインしたときだけ動く', () => {
  const f = code(fn);
  const setup = f.slice(f.indexOf('exports.setupGuestDemo'));
  assert.match(setup, /sign_in_provider/);
  assert.match(setup, /provider !== "anonymous"/);
  // 匿名の確認は、プロフィールを書き換える前に置く
  assert.ok(
    setup.indexOf('provider !== "anonymous"') < setup.indexOf('userRef.set'),
    '書き換えたあとに確認しても遅い',
  );
});
