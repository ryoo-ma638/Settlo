// 広い画面（iPad・PC）で、アプリを実機ふうの枠に収めるための決まりを見張る。
//
// 画面の高さいっぱいに器を広げると、iPad のような縦に長い端末では
// 480×1130 のような細長い箱になり、縦長のアプリに見えてしまう。
// そこで幅のほうを広げて縦横比を実機に近づけている。
// あわせて、画面いっぱいに出る部品（モーダル・シート・アシスタント）が
// 枠の外の台紙へはみ出さないようにしている。
//
// スマホ（540px未満）では --frame-inset-y が 0px なので、どの指定も効かない。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const MAIN_CSS = read('src/assets/main.css');

// 広い画面向けのかたまりだけを取り出す
const wideBlock = (() => {
  const start = MAIN_CSS.indexOf('@media (min-width: 540px)');
  assert.ok(start > -1, '広い画面向けの指定が無い');
  return MAIN_CSS.slice(start, MAIN_CSS.indexOf('/* ===', start));
})();

test('広い画面では、枠の幅を画面の高さから決めて縦長になるのを防ぐ', () => {
  assert.match(
    wideBlock,
    /--app-max:\s*max\(\s*480px\s*,\s*calc\(\(100dvh - 48px\)\s*\/\s*2\.17\)\s*\)/,
    '枠の幅が画面の高さに連動していない（縦長に戻る）',
  );
});

test('スマホでは枠の指定が変わらない', () => {
  assert.match(MAIN_CSS, /--frame-inset-y:\s*0px/, 'スマホ用の 0px が無い');
  assert.match(wideBlock, /--frame-inset-y:\s*24px/, '台紙の余白が広い画面で入っていない');
  // 540px 未満に効く場所で --app-max を書き換えていないこと
  const 外 = MAIN_CSS.slice(0, MAIN_CSS.indexOf('@media (min-width: 540px)'));
  assert.doesNotMatch(外, /--app-max:\s*max\(/, 'スマホ側の枠幅まで変えている');
});

// 下から出るシートは、以前 600px 固定で枠より広くなっていた
const 幅600だったもの = [
  'src/components/AddPaymentModal.vue',
  'src/components/InviteModal.vue',
  'src/components/RemindModal.vue',
  'src/components/ReceiptPaymentModal.vue',
  'src/components/FriendPaymentModal.vue',
  'src/views/EventDetails.vue',
];

test('下から出るモーダルは枠より広くならない', () => {
  for (const path of 幅600だったもの) {
    const source = read(path);
    assert.match(
      source,
      /max-width:\s*min\(600px,\s*var\(--app-max\)\)/,
      `${path} のモーダルが枠より広くなる`,
    );
  }
});

// 画面の下に貼り付く部品は、台紙のぶんだけ持ち上げないと枠の下に出る
const 下から出るもの = [
  ...幅600だったもの,
  'src/views/CombinedSettlementView.vue',
  'src/views/PaymentDetailView.vue',
  'src/views/EditProfileView.vue',
];

test('下から出る部品は、枠の下端で止まる', () => {
  for (const path of 下から出るもの) {
    assert.match(
      read(path),
      /padding-bottom:\s*var\(--frame-inset-y\)/,
      `${path} が枠の下にはみ出す`,
    );
  }
  assert.match(
    read('src/components/AppFooter.vue'),
    /padding:\s*16px 16px calc\(16px \+ var\(--frame-inset-y\)\)/,
    '＋の選択シートが枠の下にはみ出す',
  );
});

test('幅いっぱいに伸びるシートは枠の幅で止まる', () => {
  for (const path of ['src/views/CombinedSettlementView.vue', 'src/views/PaymentDetailView.vue']) {
    const source = read(path);
    const rule = /\.overlay-content \{([^}]*)\}/.exec(source);
    assert.ok(rule, `${path} にシートの指定が無い`);
    assert.match(rule[1], /max-width:\s*var\(--app-max\)/, `${path} のシートが画面幅まで伸びる`);
    assert.match(rule[1], /margin:\s*0 auto/, `${path} のシートが中央に来ない`);
  }
});

test('お支払いアシスタントのパネルが枠の外へ出ない', () => {
  const source = read('src/components/AppHeader.vue');
  const rule = /\.assist-layer \{([^}]*)\}/.exec(source);
  assert.ok(rule, 'アシスタントの層の指定が無い');
  assert.match(rule[1], /width:\s*min\(100%,\s*var\(--app-max\)\)/, 'パネルが台紙の上まで出る');
  assert.match(rule[1], /left:\s*50%/, 'パネルが枠の中央にそろわない');
});

test('画面の高さから測っている上限は、枠の高さに合わせる', () => {
  for (const path of [
    'src/components/OnboardingModal.vue',
    'src/components/FriendAddModal.vue',
    'src/components/ButtonTour.vue',
  ]) {
    const source = read(path);
    const 上限 = source.match(/max-height:\s*calc\(100dvh[^;]*/g) || [];
    assert.ok(上限.length > 0, `${path} に高さの上限が無い`);
    for (const 一つ of 上限) {
      assert.match(一つ, /var\(--frame-inset-y\) \* 2/, `${path} の上限が枠の高さを超える: ${一つ}`);
    }
  }
});
