// 復元用の控えを自動で消す判断のテスト。
// 本番では毎日 FAILED_PRECONDITION で落ちていて、7日経っても1件も消えていなかった。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { purgeDecision } = require('../functions/trashPurgeCore.js');

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 18, 19, 0, 0);
const cutoff = now - 7 * DAY;
const at = (ms) => ({ toMillis: () => ms });

test('7日より古く、確認待ちでなければ消す', () => {
  assert.equal(purgeDecision({ trashedAt: at(now - 8 * DAY), status: 'trashed' }, cutoff), 'delete');
});

test('相手の確認待ちなら、7日を過ぎても消さない', () => {
  assert.equal(purgeDecision({ trashedAt: at(now - 30 * DAY), status: 'pending' }, cutoff), 'keep-waiting');
  assert.equal(purgeDecision({ trashedAt: at(now - 30 * DAY), status: 'restored' }, cutoff), 'keep-waiting');
});

test('まだ7日たっていなければ消さない', () => {
  assert.equal(purgeDecision({ trashedAt: at(now - 6 * DAY), status: 'trashed' }, cutoff), 'keep-young');
  // ちょうど7日は「まだ」として残す（境界で消しすぎない）
  assert.equal(purgeDecision({ trashedAt: at(cutoff), status: 'trashed' }, cutoff), 'keep-young');
  assert.equal(purgeDecision({ trashedAt: at(cutoff - 1), status: 'trashed' }, cutoff), 'delete');
});

test('日付が読めないものは消さない', () => {
  assert.equal(purgeDecision({ status: 'trashed' }, cutoff), 'keep-unknown');
  assert.equal(purgeDecision({ trashedAt: null, status: 'trashed' }, cutoff), 'keep-unknown');
  assert.equal(purgeDecision({ trashedAt: 'こわれた値', status: 'trashed' }, cutoff), 'keep-unknown');
  assert.equal(purgeDecision(null, cutoff), 'keep-unknown');
});

test('確認待ちが終われば、次回から対象に戻る', () => {
  const old = { trashedAt: at(now - 20 * DAY) };
  assert.equal(purgeDecision({ ...old, status: 'pending' }, cutoff), 'keep-waiting');
  assert.equal(purgeDecision({ ...old, status: 'trashed' }, cutoff), 'delete');
});

test('本番の関数が、インデックスの要るクエリを使っていない', () => {
  const fn = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  const purge = fn.match(/exports\.purgeTrash[\s\S]*?\n\);/)[0]
    .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
  assert.ok(!/\.where\(/.test(purge), 'where を使うとインデックスが要る');
  assert.match(purge, /collectionGroup\("trash"\)\.get\(\)/);
  assert.match(purge, /purgeDecision\(/);
  assert.match(purge, /if \(count % 400 !== 0\) await batch\.commit\(\);/);
});
