import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const strip = (path) => readFileSync(path, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('イベント一覧は、案内から来たら進行中の1件を開く', () => {
  const code = strip('src/views/EventViews.vue');
  assert.match(code, /route\.query\.open !== 'settlement'/, '合図を見ていない');
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
