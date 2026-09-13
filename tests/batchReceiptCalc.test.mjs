// 複数レシート一括読み込み：BatchReceiptModal.vue の中の「計算・判定・文言」だけを
// Firebase もブラウザも使わずに確かめるテスト。
//   実行: node tests/batchReceiptCalc.test.mjs
//
// 確かめること
//   1. 表示している合計（sumReadyAmounts）と、実際に保存する金額の合計が
//      1円もずれずに一致する（お金にかかわる最重要のテスト）
//   2. OCR結果のクランプ（外貨・金額0・日付不明で warn になる／読める内容は登録できる）
//   3. 金額と日付がそろって初めて ready になる（4-8の再検証と同じ条件）
//   4. 保存結果の文言（全件成功・一部成功・全件失敗・応答不明・付随処理の失敗）

import assert from 'node:assert/strict';
import { evenShares } from '../src/lib/evenShares.js';
import {
  clampReceiptData,
  evaluateCardReadiness,
  sumReadyAmounts,
  summarizeBatchResults,
  describeSaveFailure,
  MAX_IMAGES,
} from '../src/lib/batchReceiptCalc.js';

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ---- 1. 表示合計と保存合計が一致する（最重要） ----------------------------
test('表示している合計（登録対象カードの合計）は、保存する側の金額の合計と1円もずれない', () => {
  const participants = [
    { id: 'a', name: 'あかり', isMe: true },
    { id: 'b', name: 'ばんり' },
    { id: 'c', name: 'ちさと' },
  ];
  const creditorUid = 'a';

  // 3枚ぶんのカード（1枚は要確認＝登録対象外、1枚は除外）を模す
  const cards = [
    { state: 'ready', amount: '6820' },
    { state: 'ready', amount: '1240' },
    { state: 'warn', amount: '' }, // 対象外（isSubmitTarget=false）
    { state: 'excluded', amount: '3000' }, // 除外（isSubmitTarget=false）
  ];

  const displayedTotal = sumReadyAmounts(cards); // 画面に出す「合計（登録対象n件）」

  // BatchReceiptModal.vue の saveCard() と同じ手順：登録対象カードだけ、
  // 送信直前に evenShares() で「そのカード専用の負担額」を固定する
  const readyCards = cards.filter((c) => c.state === 'ready');
  const perCardTotals = readyCards.map((c) => {
    const shares = evenShares(participants, Number(c.amount), creditorUid);
    return shares.reduce((sum, s) => sum + s.amount, 0); // そのカードの負担額の合計＝そのカードの総額
  });
  const savedTotal = perCardTotals.reduce((sum, t) => sum + t, 0);

  assert.equal(displayedTotal, 8060); // 6820 + 1240（warn/excludedは含めない）
  assert.equal(savedTotal, displayedTotal); // 表示と保存が1円もずれない
});

test('登録対象カードが1件も無ければ、合計は0円', () => {
  assert.equal(sumReadyAmounts([]), 0);
  assert.equal(sumReadyAmounts([{ state: 'saved', amount: '500' }]), 0); // saved は対象外
});

// ---- 2. OCR結果のクランプ ---------------------------------------------------
test('通貨がJPY以外なら金額を入れない（要確認）', () => {
  const r = clampReceiptData({ storeName: 'DUTY FREE', currency: 'USD', totalAmount: 50, date: '2026-09-13' });
  assert.equal(r.amount, '');
  assert.match(r.notice, /日本円以外/);
});

test('金額0円は「読めなかった」扱いにする（0円と決めつけない）', () => {
  const r = clampReceiptData({ storeName: '鳥貴族', currency: 'JPY', totalAmount: 0, date: '2026-09-13' });
  assert.equal(r.amount, '');
  assert.match(r.notice, /読み取れませんでした/);
});

test('日付が読めないときは日付を空にし、注意書きを添える（当日で埋めない）', () => {
  const r = clampReceiptData({ storeName: '鳥貴族', currency: 'JPY', totalAmount: 1000, date: 'ふぞろい' });
  assert.equal(r.date, '');
  assert.equal(r.amount, '1000');
  assert.match(r.notice, /日付/);
});

test('店名・金額・日付が読めればそのまま使う（店名60文字超は切り詰める）', () => {
  const longName = 'あ'.repeat(80);
  const r = clampReceiptData({ storeName: longName, currency: 'JPY', totalAmount: 6820, date: '2026-09-13' });
  assert.equal(r.store.length, 60);
  assert.equal(r.amount, '6820');
  assert.equal(r.date, '2026/09/13');
});

test('店名が空なら既定値を入れる', () => {
  const r = clampReceiptData({ storeName: '', currency: 'JPY', totalAmount: 500, date: '2026-09-13' });
  assert.equal(r.store, '不明な店舗');
});

// ---- 3. 登録できる条件（金額と日付がそろって ready） ------------------------
test('金額・日付がそろっていれば ready', () => {
  assert.equal(evaluateCardReadiness({ amount: '1000', date: '2026/09/13' }).ready, true);
});

test('金額が0円・空・上限超えなら ready にならない', () => {
  assert.equal(evaluateCardReadiness({ amount: '0', date: '2026/09/13' }).reason, 'invalid-amount');
  assert.equal(evaluateCardReadiness({ amount: '', date: '2026/09/13' }).reason, 'invalid-amount');
  assert.equal(evaluateCardReadiness({ amount: '100000000', date: '2026/09/13' }).reason, 'invalid-amount');
});

test('日付が空・形式違いなら ready にならない', () => {
  assert.equal(evaluateCardReadiness({ amount: '1000', date: '' }).reason, 'invalid-date');
  assert.equal(evaluateCardReadiness({ amount: '1000', date: '2026-09-13' }).reason, 'invalid-date');
});

// ---- 4. 保存結果の文言 -------------------------------------------------------
test('全件成功なら件数だけを伝える', () => {
  const s = summarizeBatchResults([{ status: 'saved' }, { status: 'saved' }]);
  assert.equal(s.message, '2件を保存しました。');
  assert.equal(s.savedCount, 2);
});

test('一部成功は、成功件数を先に言ってから残りを伝える', () => {
  const s = summarizeBatchResults([{ status: 'saved' }, { status: 'failed' }]);
  assert.match(s.message, /^1件を保存しました。/);
  assert.match(s.message, /1件は保存できませんでした/);
});

test('全件失敗は保存エラーの文言だけ', () => {
  const s = summarizeBatchResults([{ status: 'failed' }, { status: 'failed' }]);
  assert.match(s.message, /通信の状態を確認/);
});

test('応答不明（unknown）は「二重には入らない」ことを明記する', () => {
  const s = summarizeBatchResults([{ status: 'saved' }, { status: 'unknown' }]);
  assert.match(s.message, /確認できませんでした/);
  assert.match(s.message, /二重には入りません/);
});

test('付随処理（チャット）だけ失敗しても、保存エラーとは言わない', () => {
  const s = summarizeBatchResults([{ status: 'saved', sideEffectFails: ['チャット'] }]);
  assert.doesNotMatch(s.message, /保存エラー/);
  assert.match(s.message, /チャットの反映ができなかった/);
});

test('再送で already になったカードは、保存できた側に数える', () => {
  const s = summarizeBatchResults([{ status: 'already' }]);
  assert.equal(s.savedCount, 1);
  assert.equal(s.failedCount, 0);
});

// ---- 5. 失敗理由の日本語化 ---------------------------------------------------
test('reason が無ければ空文字（表示するものが無い）', () => {
  assert.equal(describeSaveFailure(null), '');
  assert.equal(describeSaveFailure(undefined), '');
});

test('知っている reason は日本語文にする', () => {
  assert.equal(describeSaveFailure('share-mismatch'), '割り勘の合計が総額と一致しません。');
});

test('知らない reason でも壊れず、コードを添えて表示する', () => {
  assert.match(describeSaveFailure('something-new'), /something-new/);
});

// ---- 6. 定数の整合 -----------------------------------------------------------
test('最大枚数は3枚（設計図2-3）', () => {
  assert.equal(MAX_IMAGES, 3);
});

for (const [name, fn] of cases) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  NG  ${name}`);
    console.error(`      ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${cases.length} 件 合格`);
