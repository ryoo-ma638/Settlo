// お知らせの片付け（過去7日 → 元に戻す7日 → 消滅）の判断。
// 定期処理は1日1回しか動かないので、境界をここで固定する。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { noticeDecision, WEEK_MS } = require('../functions/noticeLifecycleCore.js');

const now = Date.UTC(2026, 8, 18, 19, 0, 0);
const at = (ms) => ({ toMillis: () => ms });
const DAY = 24 * 60 * 60 * 1000;

test('まだ読んでいないお知らせは触らない', () => {
  assert.equal(noticeDecision({ isRead: false }, now), 'keep');
  assert.equal(noticeDecision({}, now), 'keep');
});

test('過去へ移った日が無ければ、まず日付を入れる', () => {
  assert.equal(noticeDecision({ isRead: true }, now), 'stamp-read');
});

test('過去に入って7日たったら、元に戻す へ移す', () => {
  assert.equal(noticeDecision({ isRead: true, readAt: at(now - 8 * DAY) }, now), 'to-trash');
  assert.equal(noticeDecision({ isRead: true, readAt: at(now - 6 * DAY) }, now), 'keep');
  // ちょうど7日で移す
  assert.equal(noticeDecision({ isRead: true, readAt: at(now - WEEK_MS) }, now), 'to-trash');
});

test('元に戻す に入って7日たったら消す', () => {
  assert.equal(noticeDecision({ inTrash: true, trashedAt: at(now - 8 * DAY) }, now), 'delete');
  assert.equal(noticeDecision({ inTrash: true, trashedAt: at(now - 6 * DAY) }, now), 'keep');
});

test('ゴミ箱の日付が読めないものは消さない', () => {
  assert.equal(noticeDecision({ inTrash: true }, now), 'keep');
  assert.equal(noticeDecision({ inTrash: true, trashedAt: null }, now), 'keep');
});

test('ゴミ箱に入っていれば、未読でも入った日から数える（手で消した分）', () => {
  assert.equal(noticeDecision({ isRead: false, inTrash: true, trashedAt: at(now - 8 * DAY) }, now), 'delete');
});

test('先に消したものが先に消える', () => {
  const 古い = noticeDecision({ inTrash: true, trashedAt: at(now - 8 * DAY) }, now);
  const 新しい = noticeDecision({ inTrash: true, trashedAt: at(now - 1 * DAY) }, now);
  assert.equal(古い, 'delete');
  assert.equal(新しい, 'keep');
});

test('壊れた入力でも落ちない', () => {
  assert.equal(noticeDecision(null, now), 'keep');
  assert.equal(noticeDecision(undefined, now), 'keep');
});
