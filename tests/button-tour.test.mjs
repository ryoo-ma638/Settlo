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

test('全部の画面を説明する（主要な入口が手順に入っている）', () => {
  // 画面を足したのにツアーへ入れ忘れると、そこだけ説明が抜ける
  const must = [
    'home-status', 'home-events',                                   // ホーム
    'avatar', 'pending', 'chat', 'bell', 'assist',                  // 画面の上
    'nav-home', 'nav-event', 'nav-add', 'nav-money', 'nav-friend',  // 下のナビ
    'sheet-event', 'sheet-payment', 'sheet-friend-split',           // ＋の3つ
    'pay-tabs', 'pay-settle', 'pay-history',                        // 支払い
    'event-check', 'event-card', 'ev-summary', 'ev-addpay',
    'ev-invite', 'ev-exit', 'ev-end', 'ev-delete',                  // イベント
    'friend-add', 'friend-row', 'fd-combined', 'fd-split', 'fd-chats', // フレンド
    'mp-profile', 'mp-notify', 'mp-friend', 'mp-history',
    'mp-approvals', 'mp-chats', 'mp-trash', 'mp-help',              // マイページ
  ];
  const missing = must.filter((name) => !steps.includes(name));
  assert.deepEqual(missing, [], '説明が抜けている画面がある');
});

test('無いこともある場所は、待たずに飛ばす', () => {
  // フレンドが0人のときなど、対象が無い手順で何秒も止まると使えない
  assert.match(tour, /optional\s*\?\s*5\s*:\s*25/, 'optional の待ち時間を短くしていない');
  const optionalCount = (tour.match(/optional:\s*true/g) || []).length;
  assert.ok(optionalCount >= 6, `optional の指定が少ない: ${optionalCount}`);
});

test('最後の手順は締めで、ホームへ戻せる', () => {
  assert.match(tour, /type:\s*'final'/);
  assert.match(tour, /ホームへ戻る/);
});
