import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const code = readFileSync('functions/index.js', 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const seed = code.slice(code.indexOf('exports.setupGuestDemo'), code.indexOf('exports.eventNetSettlement'));

test('お試しには、はじめからフレンドが1人いる', () => {
  // フレンドが0人だと「フレンドと割り勘」が空の画面で行き止まりになる
  assert.match(seed, /collection\("friends"\)\.doc\(HANAKO\)/, '自分側にフレンドが入っていない');
  assert.match(seed, /doc\(HANAKO\)\.collection\("friends"\)\.doc\(uid\)/, '相手側にフレンドが入っていない（片側だけ）');
});

test('フレンド申請の体験も残す（別の人から届く）', () => {
  // はじめからフレンドの人からは申請が来ないので、もう一人から届かせる
  const request = seed.slice(seed.indexOf('friendRequests'));
  assert.match(request, /formId: TARO/, '申請が届かない、またはフレンド済みの人から届いている');
});

test('相談が1件届いた状態にする', () => {
  // 空の会話ではAIの返信案が試せない
  assert.match(seed, /threads/, 'チャットを作っていない');
  assert.match(seed, /collection\("messages"\)\.add/, '最初の一言が無い');
});

test('イベントの外にも貸し借りを置く（まとめてが空にならないように）', () => {
  // 全部がイベントの中だと、イベント側の精算を始めたとたん
  // 「まとめて」が「精算できる相手はいません」になって試せなくなる
  const rows = [...seed.matchAll(/collection\("transactions"\)\.add\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  assert.ok(rows.length >= 6, `立て替えが少ない: ${rows.length}`);
  const outside = rows.filter((row) => !/eventId/.test(row));
  assert.equal(outside.length, 2, `イベント外の立て替えが ${outside.length} 件`);
  assert.ok(outside.some((row) => /paidToId: uid/.test(row)), '受け取る分が無い');
  assert.ok(outside.some((row) => /paidById: uid/.test(row)), '支払う分が無い（差し引きが見えない）');
});
