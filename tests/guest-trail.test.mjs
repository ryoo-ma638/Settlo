import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUEST_TRAIL, normalizeDone, trailProgress, nextTrailStep, markDone } from '../src/lib/guestTrail.js';

test('道順は3〜5分で終わる長さにする', () => {
  assert.ok(GUEST_TRAIL.length >= 5 && GUEST_TRAIL.length <= 8, `手順が${GUEST_TRAIL.length}件`);
  const seconds = GUEST_TRAIL.reduce((sum, step) => {
    const m = /^(\d+)(秒|分)$/.exec(step.minutes);
    assert.ok(m, `目安の書き方が違う: ${step.minutes}`);
    return sum + Number(m[1]) * (m[2] === '分' ? 60 : 1);
  }, 0);
  assert.ok(seconds >= 180 && seconds <= 300, `合計 ${seconds} 秒。3〜5分に収める`);
});

test('どの手順にも、行き先か合図がある', () => {
  for (const step of GUEST_TRAIL) {
    assert.ok(step.id && step.title && step.desc, `中身が足りない: ${step.id}`);
    if (step.action === 'route') assert.ok(step.to, `行き先が無い: ${step.id}`);
    else assert.equal(step.action, 'event', `action が不明: ${step.id}`);
    if (step.action === 'event') assert.ok(step.event, `合図が無い: ${step.id}`);
  }
  assert.equal(new Set(GUEST_TRAIL.map(s => s.id)).size, GUEST_TRAIL.length, 'id が重複している');
});

test('済みを付けると、次にやることが進む', () => {
  let done = [];
  assert.equal(nextTrailStep(done).id, GUEST_TRAIL[0].id);
  done = markDone(done, GUEST_TRAIL[0].id);
  assert.equal(nextTrailStep(done).id, GUEST_TRAIL[1].id);
  assert.deepEqual(trailProgress(done), { done: 1, total: GUEST_TRAIL.length, finished: false });
});

test('同じ手順を二度押しても、数は増えない', () => {
  const done = markDone(markDone([], 'event'), 'event');
  assert.equal(trailProgress(done).done, 1);
});

test('途中を飛ばして押しても、その手順は済みになる', () => {
  const done = markDone([], 'split');
  assert.equal(trailProgress(done).done, 1);
  assert.equal(nextTrailStep(done).id, GUEST_TRAIL[0].id, '飛ばした手前が次に残る');
});

test('全部済んだら、次は無い', () => {
  const done = GUEST_TRAIL.reduce((acc, step) => markDone(acc, step.id), []);
  assert.equal(nextTrailStep(done), null);
  assert.equal(trailProgress(done).finished, true);
});

test('保存が壊れていても落ちない', () => {
  for (const bad of [null, undefined, 'x', 42, ['知らないid', 'event', 'event']]) {
    const p = trailProgress(bad);
    assert.ok(p.done >= 0 && p.done <= GUEST_TRAIL.length);
  }
  assert.deepEqual(normalizeDone(['知らないid', 'event']), ['event']);
});

test('「まとめて精算してみる」は、一覧で止まらず中まで開く', () => {
  // 一覧に飛ぶだけだと、押しても何も起きないように見える
  const settle = GUEST_TRAIL.find((s) => s.id === 'settle');
  assert.ok(settle, '手順が無い');
  assert.match(settle.to, /open=settlement/, 'イベント一覧で止まっている');
  const list = GUEST_TRAIL.find((s) => s.id === 'event');
  assert.notEqual(settle.to, list.to, '「中身を見る」と同じ行き先になっている');
});
