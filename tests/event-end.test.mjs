// イベントの終了を「人ごと」にする計算。
// 1人が押すと全員の画面が即終了済みになっていたのを、合意制にする。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventEndState, endByMe } from '../src/lib/eventEnd.js';

const ev = (extra = {}) => ({ participants: ['a', 'b', 'c'], ...extra });

test('誰も押していなければ、誰の画面でも終了していない', () => {
  const s = eventEndState(ev(), 'a');
  assert.equal(s.endedForMe, false);
  assert.equal(s.endedForAll, false);
  assert.deepEqual(s.waiting, ['a', 'b', 'c']);
});

test('押した本人だけが終了済みになる', () => {
  const e = ev({ endedBy: ['a'] });
  assert.equal(eventEndState(e, 'a').endedForMe, true);
  assert.equal(eventEndState(e, 'b').endedForMe, false, '他の人は終了しない');
  assert.equal(eventEndState(e, 'b').endedForAll, false);
});

test('全員そろったら、イベント全体が終了になる', () => {
  const e = ev({ endedBy: ['a', 'b', 'c'] });
  assert.equal(eventEndState(e, 'c').endedForAll, true);
  assert.equal(eventEndState(e, 'b').endedForMe, true);
});

test('古いデータ（ended が true）は、これまでどおり全員終了', () => {
  const e = ev({ ended: true });
  assert.equal(eventEndState(e, 'a').endedForAll, true);
  assert.equal(eventEndState(e, 'a').endedForMe, true);
});

test('退出した人が endedBy に残っていても、そこで止まらない', () => {
  // d はもう参加者ではない
  const e = { participants: ['a', 'b'], endedBy: ['a', 'b', 'd'] };
  assert.equal(eventEndState(e, 'a').endedForAll, true);
  assert.equal(eventEndState(e, 'a').agreedCount, 2);
});

test('自分が押したときの結果', () => {
  const r = endByMe(ev({ endedBy: ['b'] }), 'a');
  assert.deepEqual(r.endedBy, ['b', 'a']);
  assert.equal(r.endsEvent, false);
  assert.deepEqual(r.notify, ['c'], 'まだ終えていない人にだけ知らせる');
});

test('最後の1人が押したら全体が終了し、知らせる相手はいない', () => {
  const r = endByMe(ev({ endedBy: ['a', 'b'] }), 'c');
  assert.equal(r.endsEvent, true);
  assert.deepEqual(r.notify, []);
});

test('二度押しても増えない', () => {
  const r = endByMe(ev({ endedBy: ['a'] }), 'a');
  assert.deepEqual(r.endedBy, ['a']);
});

test('壊れた入力でも落ちない', () => {
  assert.equal(eventEndState(null, 'a').endedForMe, false);
  assert.equal(eventEndState({}, 'a').endedForAll, false);
  assert.deepEqual(endByMe(null, 'a').endedBy, ['a']);
});

test('一覧は「その人にとって終了済みか」で絞る', async () => {
  const { ongoingEventsOf } = await import('../src/lib/eventMembership.js');
  const events = [
    { id: 'e1', participants: ['a', 'b'], endedBy: ['a'], createdAt: { seconds: 2 } },
    { id: 'e2', participants: ['a', 'b'], createdAt: { seconds: 1 } },
  ];
  // a は e1 を終えたので進行中に出ない
  assert.deepEqual(ongoingEventsOf(events, 'a').map((e) => e.id), ['e2']);
  // b はまだ終えていないので、両方とも進行中
  assert.deepEqual(ongoingEventsOf(events, 'b').map((e) => e.id), ['e1', 'e2']);
  // uid を渡さなければ、これまでどおり ended だけで見る
  assert.deepEqual(ongoingEventsOf(events).map((e) => e.id), ['e1', 'e2']);
});

test('お知らせの種類は「答えるまで残す」に入れる', async () => {
  const { needsAction } = await import('../src/lib/notificationPolicy.js');
  assert.equal(needsAction({ type: 'event_end_request' }), true);
});

test('参加者がオブジェクトの配列でも同じ結果になる（画面によって形が違う）', () => {
  const asUids = { participants: ['a', 'b', 'c'], endedBy: ['a'] };
  const asObjects = { participants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], endedBy: ['a'] };
  assert.equal(eventEndState(asObjects, 'a').endedForMe, true);
  assert.equal(eventEndState(asObjects, 'b').endedForMe, false);
  assert.deepEqual(eventEndState(asObjects, 'a').waiting, eventEndState(asUids, 'a').waiting);
  // uid というキーの形でも通す
  assert.equal(eventEndState({ participants: [{ uid: 'a' }], endedBy: ['a'] }, 'a').endedForAll, true);
  // 押したときの計算も同じ
  assert.deepEqual(endByMe(asObjects, 'b').notify, endByMe(asUids, 'b').notify);
});
