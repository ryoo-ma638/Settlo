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
