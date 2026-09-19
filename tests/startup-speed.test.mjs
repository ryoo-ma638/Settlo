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

test('CSSの読み込みで描画を止めない', () => {
  // <link rel="stylesheet"> は届くまで画面が出ない。
  // このアプリは firebase が届くまで中身を描けないので、CSSを待つ必要が無い。
  assert.match(vite, /nonBlockingCss\(\)/, 'ビルド時の書き換えを入れていない');
  assert.match(vite, /rel="preload" as="style"/, 'preload に変えていない');
  assert.match(vite, /<noscript>/, 'JavaScriptが動かない環境でCSSが当たらない');
});

test('CSSが当たってから画面を描く', () => {
  // 当たる前に描くと、色や背景が無い状態が一瞬見える
  const main = readFileSync('src/main.js', 'utf8');
  assert.match(main, /stylesReady\(\)\.then\(\(\) => app\.mount/, 'CSSを待たずに描いている');
  assert.match(main, /setTimeout\(done, 2000\)/, '待ちっぱなしになる恐れがある（見切りが無い）');
});

test('起動時に要らない firebase の部品を分ける', () => {
  // 通知と画像アップロードは起動時に使わない。まとめると起動が重くなる。
  assert.match(vite, /firebase-messaging/, '通知が起動時のファイルに入る');
  assert.match(vite, /firebase-storage/, '画像アップロードが起動時のファイルに入る');
  // ⚠️ firestore と auth は割らない。以前それで起動が壊れた
  assert.ok(!/'firebase-firestore'|'firebase-auth'/.test(vite), 'firestore や auth を割ってはいけない');
  const notif = readFileSync('src/lib/notificationSettings.js', 'utf8');
  assert.match(notif, /await import\('firebase\/messaging'\)/, '通知を最初から読み込んでいる');
  const router = readFileSync('src/router/index.js', 'utf8');
  assert.match(router, /EditProfile',[^}]*import\('\.\.\/views\/EditProfileView\.vue'\)/, 'プロフィール編集を最初から読み込んでいる');
});

test('カルーセルのすき間を、自分で計算し直さない', () => {
  // CSSのすき間は8px固定なのに、矢印の処理が window.innerWidth * 0.04（390pxで15.6px）
  // を使っていて、押すたびに約7.6pxずれた。左へ行って戻ると真ん中が左に寄ったままになる。
  // 説明のコメントには書いてあるので、コメントを外してから見る
  const c = readFileSync('src/components/PaymentCarousel.vue', 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/innerWidth \* 0\.04/.test(c), 'すき間を画面幅から勝手に計算している');
  assert.match(c, /scrollIntoView\(\{[^}]*inline: 'center'/, 'カードそのものを真ん中へ寄せていない');
  assert.match(c, /block: 'nearest'/, '縦にも動いてしまう');
});
