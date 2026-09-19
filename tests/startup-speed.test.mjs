import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// 会場の電波（1.6Mbps・遅延90ms・CPU4倍遅く）で測ったところ、
// 最初の文字が出るまで2.5秒かかっていた。その原因を潰した設定を、ここで固定する。

const html = readFileSync('index.html', 'utf8');
const vite = readFileSync('vite.config.js', 'utf8');
const app = readFileSync('src/App.vue', 'utf8');

// コメントの中に書いてある分は「読み込んでいない」とみなす
const 生きている行 = html.split('\n').filter((l, i, a) => {
  const 前 = a.slice(0, i + 1).join('\n');
  const 開き = (前.match(/<!--/g) || []).length;
  const 閉じ = (前.match(/-->/g) || []).length;
  return 開き === 閉じ;
}).join('\n');

test('描画を止める外部フォントを読み込まない', () => {
  // Noto Sans JP の指定CSSは119KBあり、届くまで画面が出ない（実測2.0秒）。
  // 端末に入っている書体を使う。指定は base.css の --font-sans に残してある。
  assert.ok(!/fonts\.googleapis\.com[^>]*rel=["']stylesheet/.test(生きている行),
    '外部フォントのCSSを読み込んでいる。最初の描画が2秒遅くなる');
  const css = readFileSync('src/assets/base.css', 'utf8');
  assert.match(css, /--font-sans:[^;]*Hiragino/, '端末の書体への逃げ道が無い');
});

test('読み込み画面がHTMLに直接入っている', () => {
  // JavaScript が届く前に何か出したい。外部の読み込みを待つ作りにしない。
  assert.match(生きている行, /class="boot"/, '読み込み画面が無い');
  assert.match(生きている行, /Settlo を読み込み中/, '読み込み中だと分かる文字が無い');
  assert.ok(!/<div id="app"><\/div>/.test(生きている行), '中身が空のまま');
});

test('CSSは1本にまとめる', () => {
  // 画面ごとに分けると、移った瞬間に取りに行って、文字だけ先に出る
  assert.match(vite, /cssCodeSplit:\s*false/, 'CSSが画面ごとに分かれる');
});

test('あとで開く画面を先読みする', () => {
  assert.match(app, /prefetchRoutes\(\)/, '先読みを呼んでいない');
  const pre = readFileSync('src/lib/prefetchRoutes.js', 'utf8');
  for (const 画面 of ['EventDetails', 'ThreadView', 'ChatListView', 'CombinedSettlementView', 'CombinedActionView']) {
    assert.ok(pre.includes(画面), `案内で通る ${画面} を先読みしていない`);
  }
  assert.match(pre, /saveData/, '通信を節約したい人への配慮が無い');
});
