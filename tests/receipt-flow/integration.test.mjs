import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const eventSource = readFileSync(new URL('../../src/views/EventDetails.vue', import.meta.url), 'utf8');
const functionsSource = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');
const notificationSource = readFileSync(new URL('../../src/components/NotificationIcon.vue', import.meta.url), 'utf8');
const countsSource = readFileSync(new URL('../../src/composables/useNotificationCounts.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8');
const threadSource = readFileSync(new URL('../../src/views/ThreadView.vue', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../../src/views/EditProfileView.vue', import.meta.url), 'utf8');

test('イベント詳細から実AddPaymentModalへ複数保存に必要な値を渡し、単枚submitを維持する', () => {
  const block = eventSource.match(/<AddPaymentModal[\s\S]*?\/>/)?.[0] || '';
  for (const expected of [
    ':eventId="route.params.id || \'\'"',
    ':eventName="eventData.name || \'\'"',
    ':eventEnded="!!eventData.ended"',
    ':participants="eventData.participants"',
    ':myUid="auth.currentUser?.uid || \'\'"',
    '@submit="addHistory"',
  ]) assert.ok(block.includes(expected), expected);
});

test('Functions入口が明示許可型pushと登録単位の要約本文を通す', () => {
  assert.match(functionsSource, /require\("\.\/paymentAddedNotifications"\)/);
  assert.match(functionsSource, /exports\.publishPaymentAddedNotifications\s*=\s*paymentAdded\.publishPaymentAddedNotifications/);
  assert.match(functionsSource, /const policy = policyForNotification\(data\)/);
  assert.match(functionsSource, /if \(!policy\.send\) return/);
  assert.match(functionsSource, /settingsAllowPush/);
  assert.match(functionsSource, /data: \{ title: "Settlo", body, url, tag \}/);
});

test('許可要求・プロフィール通知・チャットベル通知を自動作成しない', () => {
  assert.doesNotMatch(appSource, /Notification\.requestPermission/);
  assert.doesNotMatch(profileSource, /type:\s*'profile_updated'/);
  assert.doesNotMatch(threadSource, /type:\s*'thread_reply'/);
  assert.match(functionsSource, /exports\.pushOnThreadMessage/);
});

test('個別のお知らせを明細の追加として表示し、対象履歴へ進める', () => {
  assert.match(notificationSource, /req\.type === 'payment_added'/);
  assert.match(notificationSource, /さんが「\$\{req\.itemName \|\| '支払い'\}」/);
  assert.match(notificationSource, /updateDoc\(doc\(db, "notifications", req\.id\), \{ isRead: true \}\)/);
  assert.match(notificationSource, /\?history=\$\{encodeURIComponent\(req\.historyId\)\}/);
  assert.match(countsSource, /'payment_added'/);
});

test('お知らせから対象の立て替え履歴を1件だけ開く', () => {
  assert.match(eventSource, /\(\) => route\.query\.history/);
  assert.match(eventSource, /historyLoaded/);
  assert.match(eventSource, /eventData\.value\.history\.find\(\(item\) => item\.id === historyId\)/);
  assert.match(eventSource, /openHistoryDetail\(history\)/);
  assert.match(eventSource, /router\.replace\(\{ query \}\)/);
  assert.match(eventSource, /立て替え履歴が見つかりません/);
});
