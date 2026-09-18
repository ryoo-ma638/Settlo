// イベント退出の判断を確かめるテスト。
//   実行: node --test tests/event-membership.test.mjs
//
// 確かめること
//   1. リーダーは退出できない
//   2. まとめて精算の最中は退出できない
//   3. 未精算が残っていても退出できる（支払い画面には残る、と伝える）
//   4. 払う分と受け取る分を混ぜて合算しない
//   5. 参加していない人には退出を出さない

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventExitState, myOutstanding } from '../src/lib/eventMembership.js';

const ME = 'me', A = 'a', B = 'b';
const ev = (extra = {}) => ({ participants: [ME, A, B], leaderUid: A, ...extra });
const share = (uid, amount, settled = false, isDebt = true) => ({ uid, amount, settled, isDebt });

test('リーダーのままでは退出できない', () => {
  const state = eventExitState({ event: ev({ leaderUid: ME }), myUid: ME });
  assert.equal(state.canLeave, false);
  assert.equal(state.blockedBy, 'leader');
  assert.match(state.message, /リーダーを引き継ぐ|引き継ぐ/);
});

test('まとめて精算の最中は退出できない', () => {
  const state = eventExitState({ event: ev({ activeEventSettlementPlanId: 'plan-1' }), myUid: ME });
  assert.equal(state.canLeave, false);
  assert.equal(state.blockedBy, 'settling');
});

test('精算が済んでいれば、そのまま退出できる', () => {
  const state = eventExitState({ event: ev(), myUid: ME, outstanding: myOutstanding([], ME) });
  assert.equal(state.canLeave, true);
  assert.equal(state.blockedBy, null);
  assert.match(state.message, /過去の記録は残ります/);
});

test('未精算が残っていても退出でき、支払い画面に残ると伝える', () => {
  const histories = [
    { payerUid: A, shares: [share(ME, 1200), share(B, 800)] },
    { payerUid: A, shares: [share(ME, 380)] },
  ];
  const outstanding = myOutstanding(histories, ME);
  assert.equal(outstanding.payCount, 2);
  assert.equal(outstanding.payAmount, 1580);
  const state = eventExitState({ event: ev(), myUid: ME, outstanding });
  assert.equal(state.canLeave, true);
  assert.match(state.message, /支払う分2件（¥1,580）/);
  assert.match(state.message, /退出後も支払い画面に残ります/);
  assert.match(state.message, /新しい支払いを追加されることはありません/);
});

test('払う分と受け取る分を混ぜて合算しない', () => {
  const histories = [
    { payerUid: ME, shares: [share(A, 500), share(B, 700)] }, // 自分が立て替え＝受け取る
    { payerUid: A, shares: [share(ME, 300)] },                 // 自分が負担＝払う
  ];
  const outstanding = myOutstanding(histories, ME);
  assert.deepEqual(
    { p: outstanding.payCount, pa: outstanding.payAmount, r: outstanding.receiveCount, ra: outstanding.receiveAmount },
    { p: 1, pa: 300, r: 2, ra: 1200 },
  );
  const state = eventExitState({ event: ev(), myUid: ME, outstanding });
  assert.match(state.message, /支払う分1件（¥300）と受け取る分2件（¥1,200）/);
});

test('精算済みの分と、立替者本人の取り分は数えない', () => {
  const histories = [
    { payerUid: A, shares: [share(ME, 500, true), share(B, 500)] },      // 自分の分は精算済み
    { payerUid: ME, shares: [share(ME, 400, false, false), share(A, 600)] }, // 立替者本人は債務でない
  ];
  const outstanding = myOutstanding(histories, ME);
  assert.equal(outstanding.payCount, 0);
  assert.equal(outstanding.receiveCount, 1);
  assert.equal(outstanding.receiveAmount, 600);
});

test('参加していない人には退出を出さない', () => {
  assert.equal(eventExitState({ event: ev(), myUid: 'stranger' }).blockedBy, 'not-member');
  assert.equal(eventExitState({ event: ev(), myUid: '' }).blockedBy, 'not-member');
});

test('参加者が名前つきの形でも判定できる', () => {
  const event = { participants: [{ id: ME, name: '自分' }, { id: A }], leaderUid: A };
  assert.equal(eventExitState({ event, myUid: ME }).canLeave, true);
});

test('こわれた入力でも落ちない', () => {
  assert.equal(eventExitState().blockedBy, 'not-member');
  assert.equal(myOutstanding(null, ME).count, 0);
  assert.equal(myOutstanding([null, { shares: null }], ME).count, 0);
});
