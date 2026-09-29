// 画面の地の文が同じことを何度も言うと、読む量だけ増えて大事な文が埋もれる。
// お支払い・精算はタブごとに同じ説明を書き写していたので、タブの外へ1か所だけ出した。
// ここでは「消した文が1回だけになっていること」と、
// 「誤送金に直結するので残すと決めた文が消えていないこと」の両方を見張る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MONEY = read('../src/views/MoneyPage.vue');
const EVENT = read('../src/views/EventDetails.vue');
const CAROUSEL = read('../src/components/PaymentCarousel.vue');
const countOf = (source, text) => source.split(text).length - 1;

const LOAD_WARNING = '一部の取引を確認できないため、確認できた分を表示しています。';
const OFFSET_HINT_TITLE = 'この一覧は1件ずつの額面です';
const EVENT_SETTLE_NOTE = 'この分はイベントの「まとめて精算」でやり取りします。';
const REVIEW_NOTE = '追加で送金せず、相手と送金済みか確認してください。';

test('タブごとに書き写していた3つの説明が、お支払い・精算に1回だけ出る', () => {
  assert.equal(countOf(MONEY, LOAD_WARNING), 1, '取引を確認できない旨がまた2か所に置かれている');
  assert.equal(countOf(MONEY, OFFSET_HINT_TITLE), 1, '額面と差し引きの違いのヒント枠がまた2か所に置かれている');
  assert.equal(countOf(MONEY, EVENT_SETTLE_NOTE), 1, 'イベントで精算中の説明がまた2か所に置かれている');
});

test('1回だけになった3つの説明は、お支払い待ち・未払いのどちらのタブでも読める', () => {
  // タブの中に戻すと、片方のタブでしか読めない説明になってしまう。
  const open = MONEY.indexOf(`<template v-if="currentTab !== 'settle'">`);
  assert.notEqual(open, -1, '3つの説明をタブの外へ出す入れ物が無い');
  const close = MONEY.indexOf('</template>', open);
  const inShared = (text) => {
    const at = MONEY.indexOf(text);
    return at > open && at < close;
  };
  assert.ok(inShared(LOAD_WARNING), '取引を確認できない旨がタブの中に戻っている');
  assert.ok(inShared(OFFSET_HINT_TITLE), 'ヒント枠がタブの中に戻っている');
  assert.ok(inShared(EVENT_SETTLE_NOTE), 'イベントで精算中の説明がタブの中に戻っている');
  // イベントの説明は、開いているタブに対象の取引があるときだけ出す。
  // 受け取る側の件数だけを見ると、未払いタブで説明が出ないか、無い説明が出る。
  assert.match(MONEY, /if \(currentTab\.value === 'waiting'\) return receivableEvent\.value\.length/, '受け取る側の件数を見ていない');
  assert.match(MONEY, /if \(currentTab\.value === 'unpaid'\) return payableEvent\.value\.length/, '支払う側の件数を見ていない');
});

test('誤送金に直結する文は、引き算の対象にしない', () => {
  // 送金状況の確認は、お支払い待ちと未払いのどちらでも同じ危険があるので両方に置く。
  assert.equal(countOf(MONEY, REVIEW_NOTE), 2, '送金状況を確認してほしい文が片方のタブから消えている');
  assert.match(EVENT, /受取を確認できなかった支払いがあります。/, 'イベント詳細の受取確認の注記が消えている');
  // ホームのカードは別の画面なので、同じ文でも1か所として残す。
  assert.equal(countOf(CAROUSEL, LOAD_WARNING), 1, 'ホームのカードから取引を確認できない旨が消えている');
});

test('まとめてタブの説明（#346で足した分）は残っている', () => {
  assert.match(MONEY, /イベント側でまとめて精算を始めると、そのイベントの分はここから外れて金額が変わります/, 'まとめてタブの前置きが消えている');
  assert.match(MONEY, /\{\{ eventPortionText\(m\.uid\) \}\}/, '各行のイベントの分の内訳が消えている');
});
