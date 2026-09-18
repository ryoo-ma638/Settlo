// お知らせの切り分けを確かめるテスト。
//   実行: node --test tests/notification-policy.test.mjs
//
// 確かめること
//   1. 答える必要があるお知らせは、確認だけでは過去へ送らない
//   2. 読むだけのお知らせは、確認で過去へ送れる
//   3. 過去のお知らせは残り、ベルの数には入らない
//   4. 古い形式（isRead が無い）を未読として扱う
//   5. 新しい順に並び、過去は上限で切る

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { needsAction, isUnread, canDismiss, splitNotifications } from '../src/lib/notificationPolicy.js';

const n = (id, type, isRead = false, sec = 0) => ({ id, type, isRead, createdAt: { seconds: sec } });

test('答える必要があるお知らせは、確認だけで過去へ送らない', () => {
  for (const type of ['approval_request', 'event_invite', 'event_settlement_approval_request',
    'settlement_restore_request', 'payment_added', 'thread_reply',
    'event_member_removed', 'restore_check', 'event_left_check']) {
    assert.equal(needsAction(n('x', type)), true, type);
    assert.equal(canDismiss(n('x', type)), false, type);
  }
});

test('読むだけのお知らせは、確認で過去へ送れる', () => {
  for (const type of ['payment_completed', 'payment_reminder', 'approval_rejected',
    'payment_reverted', 'event_settlement_approved', 'profile_updated']) {
    assert.equal(needsAction(n('x', type)), false, type);
    assert.equal(canDismiss(n('x', type)), true, type);
  }
});

test('既読にしたものは、いま出す一覧から過去へ移る', () => {
  const rows = [n('a', 'payment_completed', false, 3), n('b', 'approval_request', false, 2)];
  let split = splitNotifications(rows);
  assert.deepEqual(split.active.map((x) => x.id), ['a', 'b']);
  assert.deepEqual(split.archived, []);
  assert.equal(split.unreadCount, 2);

  // a を確認した
  split = splitNotifications([{ ...rows[0], isRead: true }, rows[1]]);
  assert.deepEqual(split.active.map((x) => x.id), ['b']);
  assert.deepEqual(split.archived.map((x) => x.id), ['a']);
  assert.equal(split.unreadCount, 1);
});

test('答え終わった依頼も、消えずに過去へ残る', () => {
  const split = splitNotifications([n('a', 'approval_request', true, 1)]);
  assert.deepEqual(split.active, []);
  assert.deepEqual(split.archived.map((x) => x.id), ['a']);
  assert.equal(split.unreadCount, 0);
});

test('確認で送れるものだけを取り出せる', () => {
  const split = splitNotifications([
    n('info', 'payment_completed', false, 2),
    n('ask', 'approval_request', false, 1),
  ]);
  assert.deepEqual(split.dismissible.map((x) => x.id), ['info']);
});

test('古い形式（isRead が無い）は未読として扱う', () => {
  const old = { id: 'old', type: 'payment_completed', createdAt: { seconds: 1 } };
  assert.equal(isUnread(old), true);
  assert.equal(splitNotifications([old]).unreadCount, 1);
});

test('新しい順に並び、過去は上限で切る', () => {
  const rows = [];
  for (let i = 0; i < 60; i += 1) rows.push(n(`r${i}`, 'payment_completed', true, i));
  const split = splitNotifications(rows, { archiveLimit: 10 });
  assert.equal(split.archived.length, 10);
  assert.equal(split.archivedTotal, 60);
  assert.deepEqual(split.archived.map((x) => x.id), ['r59', 'r58', 'r57', 'r56', 'r55', 'r54', 'r53', 'r52', 'r51', 'r50']);
});

test('空・こわれた入力でも落ちない', () => {
  for (const input of [undefined, null, [], [null, undefined]]) {
    const split = splitNotifications(input);
    assert.deepEqual(split.active, []);
    assert.equal(split.unreadCount, 0);
  }
});
