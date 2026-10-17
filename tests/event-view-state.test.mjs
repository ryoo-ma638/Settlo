// イベント詳細の表示状態の決め方。
// 見るのは3つ：通信が遅いだけでは状態を変えない／権限なしと「見つからない」「読み込み失敗」を分ける／止めた状態では案内が出る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_VIEW, eventViewStateAfterError, eventViewStateAfterSnapshot, eventViewMessage, isBlockedState } from '../src/lib/eventViewState.js';

test('通信が遅いだけ（エラーも文書も届かない）では、読み込み中のまま変えない', () => {
  // 状態を変える入口は2つだけ。何も届かなければ呼ばれない＝loading のまま。
  assert.equal(EVENT_VIEW.LOADING, 'loading');
  assert.equal(eventViewMessage(EVENT_VIEW.LOADING), null);
  assert.equal(isBlockedState(EVENT_VIEW.LOADING), false);
});

test('権限なし（permission-denied）だけを「表示できない」にする', () => {
  assert.equal(eventViewStateAfterError('permission-denied'), EVENT_VIEW.DENIED);
  for (const code of ['unavailable', 'deadline-exceeded', 'cancelled', 'internal', undefined, null]) {
    assert.equal(eventViewStateAfterError(code), EVENT_VIEW.ERROR, `${code} は読み込み失敗として扱う`);
  }
});

test('文書が無ければ「見つからない」、あれば表示できる。キャッシュ由来の「無し」は読み込み中のまま', () => {
  assert.equal(eventViewStateAfterSnapshot(false, false), EVENT_VIEW.MISSING);
  assert.equal(eventViewStateAfterSnapshot(true, false), EVENT_VIEW.READY);
  assert.equal(eventViewStateAfterSnapshot(true, true), EVENT_VIEW.READY);
  // 通信が届いていない間に返る「キャッシュ由来で文書なし」は、見つからないと決めつけない
  assert.equal(eventViewStateAfterSnapshot(false, true), EVENT_VIEW.LOADING);
  assert.equal(eventViewMessage(EVENT_VIEW.READY), null);
});

test('止めた状態では案内があり、再読み込みは通信の失敗のときだけ勧める', () => {
  for (const state of [EVENT_VIEW.DENIED, EVENT_VIEW.MISSING, EVENT_VIEW.ERROR]) {
    assert.equal(isBlockedState(state), true);
    const m = eventViewMessage(state);
    assert.ok(m && m.title && m.text, `${state} に案内がある`);
    assert.equal(m.canRetry, state === EVENT_VIEW.ERROR);
  }
  assert.match(eventViewMessage(EVENT_VIEW.DENIED).text, /参加している/);
});
