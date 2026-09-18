// 消したお知らせから手続きをやり直せるか。
// そのまま押せると金額が狂うので、押させない条件をここで固定する。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { noticeActionState, noticeActionLabel } from '../src/lib/noticeAction.js';

const reminder = (extra = {}) => ({ type: 'payment_reminder', transactionId: 't1', ...extra });

test('ふつうの未払いなら、手続きに戻れる', () => {
  const s = noticeActionState({ notification: reminder(), transaction: { status: 'unpaid' } });
  assert.equal(s.can, true);
  assert.equal(noticeActionLabel(s), 'この件に戻って手続きする');
});

test('まとめて精算に取り込まれていたら戻せない', () => {
  const s = noticeActionState({
    notification: reminder(),
    transaction: { status: 'unpaid', eventSettlementPlanId: 'plan-1' },
  });
  assert.equal(s.can, false);
  assert.match(s.reason, /まとめて精算に取り込まれました/);
});

test('相手が先に完了させていたら、承認をもらう形にする', () => {
  const s = noticeActionState({ notification: reminder(), transaction: { status: 'completed' } });
  assert.equal(s.can, true);
  assert.equal(s.needsApproval, true);
  assert.equal(noticeActionLabel(s), '相手に確認を依頼する');
});

test('対象の取引が消えていたら戻せない', () => {
  const s = noticeActionState({ notification: reminder(), transaction: null });
  assert.equal(s.can, false);
  assert.match(s.reason, /見つかりません/);
});

test('イベントごと消えていたら戻せない', () => {
  const s = noticeActionState({
    notification: reminder({ eventId: 'ev1' }), transaction: { status: 'unpaid' }, event: null,
  });
  assert.equal(s.can, false);
  assert.match(s.reason, /イベントは無くなっています/);
});

test('読むだけのお知らせには手続きが無い', () => {
  for (const type of ['payment_completed', 'friend_approved', 'event_settlement_started']) {
    const s = noticeActionState({ notification: { type } });
    assert.equal(s.can, false);
    assert.match(s.reason, /読むだけ/);
  }
});

test('壊れた入力でも落ちない', () => {
  assert.equal(noticeActionState().can, false);
  assert.equal(noticeActionState({}).can, false);
  assert.equal(noticeActionLabel(null), '');
});
