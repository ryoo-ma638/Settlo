import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('functions/index.js', 'utf8');
const code = source.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('AIは、みんなの精算のチャットの会話も読める', () => {
  // 1対1のチャットしか見ていなかったので、本流のグループチャットでは
  // 「まだやりとりがないため、相談できません。」になっていた。
  assert.match(code, /pay-\$\{tx\.historyId\}/, 'グループチャットを見ていない');
});

test('グループの会話は、参加者のときだけ読む', () => {
  // 当事者確認だけでは足りない。そのチャットの参加者かを必ず確かめる。
  assert.match(code, /participants\.includes\(myUid\)/, '参加者の確認が無い');
  const guard = code.indexOf('participants.includes(myUid)');
  const read = code.indexOf('messages = await readMessages(groupId)');
  assert.ok(guard !== -1 && read !== -1 && guard < read, '確認の前に読んでいる');
});
