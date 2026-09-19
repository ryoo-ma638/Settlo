import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// 相談画面は #app（overflow:hidden）にぴったり収める作りなので、
// 中の部品が伸びると、はみ出した分はどこにもスクロールできず見られなくなる。
// 2026-09-19に「AIと返信を考える」→「指定する」で入力欄が画面の下へ消えた。
const css = readFileSync('src/views/ThreadView.vue', 'utf8')
  .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');

const ruleOf = (selector) => {
  const m = new RegExp(`\\n\\${selector}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `${selector} の指定が無い`);
  return m[1];
};

test('返信の下書きは、伸びても中でスクロールできる', () => {
  const body = ruleOf('.rh__body');
  assert.match(body, /overflow-y:\s*auto/, '下書きの中がスクロールしない');
  assert.match(body, /min-height:\s*0/, '縮まないので、上限を決めても中がはみ出る');
});

test('返信の下書きは、画面いっぱいまで伸びない', () => {
  const box = ruleOf('.rh');
  assert.match(box, /max-height:\s*\d/, '高さの上限が無い');
  assert.match(box, /min-height:\s*0/, '狭い画面で縮まない');
  assert.match(box, /flex-direction:\s*column/, '中の枠に高さが伝わらない');
});

test('入力欄とクイック返信は、下書きに押し出されない', () => {
  for (const selector of ['.thread__compose', '.thread__quick']) {
    assert.match(ruleOf(selector), /flex-shrink:\s*0/, `${selector} が潰れる`);
  }
});

test('会話の一覧は、下書きに場所を譲れる', () => {
  assert.match(ruleOf('.thread__body'), /overflow-y:\s*auto/, '会話側がスクロールしない');
});

test('「AIに相談する」が、押せるボタンに見える', () => {
  // 指定が1つも無く、ただの黒い文字（高さ24px）で見出しと区別がつかなかった（2026-09-19）
  assert.match(css, /\.rh__ai-btn\s*\{[^}]*min-height:\s*4[0-9]px/, 'ボタンの高さが指で押せる大きさでない');
  assert.match(css, /\.rh__ai\s*\{[^}]*border-top/, '前の内容と区切られていない');
  const tpl = readFileSync('src/views/ThreadView.vue', 'utf8');
  assert.match(tpl, /class="btn-brand rh__ai-btn"/, '共通のボタン部品を使っていない');
  assert.match(tpl, /rh__ai-icon/, '何のボタンか分かる印が無い');
});

test('AIの答えの見た目が決まっている', () => {
  // 要約・気をつける点・分からなかったことは、どれも指定が無かった
  for (const 名 of ['rh__ai-summary', 'rh__ai-issue', 'rh__ai-missing', 'rh__ai-note']) {
    assert.ok(css.includes('.' + 名), `${名} の見た目が決まっていない`);
  }
});
