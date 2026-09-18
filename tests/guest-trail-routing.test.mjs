import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const strip = (path) => readFileSync(path, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('イベント一覧は、案内から来たら進行中の1件を開く', () => {
  const code = strip('src/views/EventViews.vue');
  assert.match(code, /mode !== 'first' && mode !== 'settlement'/, '合図を見ていない');
  assert.match(code, /focus=settlement/, 'イベント詳細へ合図を渡していない');
  assert.match(code, /router\.replace/, '戻るで一覧へ戻れなくなる（push している）');
  assert.match(code, /watch\(visibleEvents/, '読み込み前に判定していて、空振りする');
});

test('イベント詳細は、案内から来たらまとめて精算まで送る', () => {
  const code = strip('src/views/EventDetails.vue');
  assert.match(code, /focus !== 'settlement'/, '合図を見ていない');
  assert.match(code, /showUnpaidSummary\(\)/, 'まとめて精算まで送っていない');
  assert.match(code, /const \{ focus: _focus, \.\.\.query \} = route\.query/, '合図を消していない（読み直しで毎回飛ぶ）');
});

test('監視は、見ている値を作ったあとに書く（読み込み順で落ちないように）', () => {
  // watch は最初に一度その値を読む。作る前に書くと、画面そのものが動かなくなる。
  // 同じ間違いを2回やったので、並び順をテストで固定する。
  const code = strip('src/views/EventViews.vue');
  const made = code.indexOf('const visibleEvents = computed(');
  const watched = code.indexOf('watch(visibleEvents');
  assert.ok(made !== -1 && watched !== -1, '目印が見つからない');
  assert.ok(made < watched, 'visibleEvents を作る前に監視している');
});
