import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const tour = readFileSync('src/components/ButtonTour.vue', 'utf8');

// src 全体を1つの文字列にして、data-tour の付け先を集める
const allSource = (function walk(dir) {
  let out = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += walk(path);
    else if (/\.(vue|js)$/.test(entry.name) && entry.name !== 'ButtonTour.vue') out += readFileSync(path, 'utf8');
  }
  return out;
}('src'));

const steps = [...tour.matchAll(/sel:\s*'\[data-tour="([^"]+)"\]'/g)].map((m) => m[1]);

test('ツアーが指す目印は、すべて実際の画面に置いてある', () => {
  assert.ok(steps.length > 10, `手順が少なすぎる: ${steps.length}`);
  // 動的に付けているところ（:data-tour="… ? 'event-card' : null"）もあるので、
  // 属性そのものと、文字列としての出現の両方を見る
  const placed = (name) => allSource.includes(`data-tour="${name}"`) || allSource.includes(`'${name}'`);
  const missing = steps.filter((name) => !placed(name));
  assert.deepEqual(missing, [], '画面に無い目印を指している手順がある');
});

test('「＋」の3つの選択肢は、すべてツアーで説明する', () => {
  // 選択肢を足したのにツアーへ入れ忘れると、説明が1つ足りないまま出てしまう
  for (const name of ['sheet-event', 'sheet-payment', 'sheet-friend-split']) {
    assert.ok(steps.includes(name), `${name} の手順が無い`);
  }
});

test('ふきだしは高さを測って画面内に収める', () => {
  // 対象が縦に長いと、下に出したふきだしが画面の外へ出て「次へ」が押せなくなる
  assert.match(tour, /measurePop/, 'ふきだしの高さを測っていない');
  assert.match(tour, /offsetHeight/, '実際の高さを見ていない');
  assert.ok(!/transform:\s*'translateY\(-50%\)'/.test(tour), '高さを測らずに中央寄せしている');
});

test('もう使われていない言葉が残っていない', () => {
  // 画面から消えた説明が手順に残ると、見た人が探して見つからない
  for (const word of ['今月の収支', '承認制なので勝手に追加されません']) {
    assert.ok(!tour.includes(word), `古い説明が残っている: ${word}`);
  }
});
