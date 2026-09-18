// 過去のお知らせは1行の要約しか出ておらず、何の話だったのか分からなかった。
// 中身（相手・イベント・内容・金額・日時）を出せる形に整える部分のテスト。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationDetail, hasDetail } from '../src/lib/notificationDetail.js';

const at = (sec) => ({ seconds: sec });

test('相手・イベント・内容・金額・日時が出る', () => {
  const d = notificationDetail({
    fromUserName: 'デモ太郎', eventName: '札幌旅行', itemName: 'レンタカー',
    amount: 3000, createdAt: at(1789700000),
  });
  assert.deepEqual(d.rows, [
    { label: '相手', value: 'デモ太郎さん' },
    { label: 'イベント', value: '札幌旅行' },
    { label: '内容', value: 'レンタカー' },
    { label: '金額', value: '¥3,000' },
  ]);
  assert.ok(d.when.length > 0);
});

test('イベント名が内容と同じときは二重に出さない', () => {
  const d = notificationDetail({ eventName: 'レンタカー', itemName: 'レンタカー', amount: 3000 });
  assert.deepEqual(d.rows.map((r) => r.label), ['内容', '金額']);
});

test('汎用語や空は出さない', () => {
  const d = notificationDetail({ fromUserName: '', eventName: '精算', itemName: '  ', amount: 0 });
  assert.deepEqual(d.rows, []);
  assert.equal(hasDetail({ eventName: 'イベント' }), false);
});

test('相手の一言と変更の内訳を添える', () => {
  const d = notificationDetail({ userMessage: 'PayPayで送りました', changes: '金額 3000→2000' });
  assert.equal(d.note, 'PayPayで送りました\n金額 3000→2000');
});

test('金額が0や文字でも金額の行を出さない', () => {
  for (const amount of [0, -100, null, undefined, 'たくさん', NaN]) {
    const d = notificationDetail({ amount });
    assert.equal(d.rows.some((r) => r.label === '金額'), false, String(amount));
  }
});

test('壊れた入力でも落ちない', () => {
  assert.deepEqual(notificationDetail(null).rows, []);
  assert.deepEqual(notificationDetail(undefined).rows, []);
  assert.equal(hasDetail(null), false);
});
