// 精算まわりの数字が食い違って見える件は、計算ではなく説明の不足だった。
// 見出し語と注記を戻すと、イベント詳細に「未精算の残り ¥10,000」と
// 送金案の合計 ¥5,000 が説明なしで並ぶ画面に戻るので、言葉そのものを見張る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const EVENT = read('src/views/EventDetails.vue');
const MONEY = read('src/views/MoneyPage.vue');
// 画面に出る言葉だけを見る（説明のコメントに同じ語が出ても誤検知しないように）
const templateOf = (source) => source.slice(0, source.indexOf('\n</template>'));
const EVENT_VIEW = templateOf(EVENT);

test('イベント詳細の大きい数字は、相殺の前後どちらかが見出しで分かる', () => {
  assert.doesNotMatch(EVENT_VIEW, /未精算の残り/, '相殺の前後が分からない見出しに戻っている');
  assert.match(EVENT_VIEW, /\{\{ outstandingLabel \}\}/, '見出しが状態で切り替わらない');
  assert.match(EVENT, /'相殺前の未精算'/, '相殺前だと分かる言葉が無い');
  assert.match(EVENT, /'精算の残り'/, '精算を始めたあとの言葉が無い');
});

test('まとめて精算の注記に、相殺後に実際に動く合計が出る', () => {
  assert.match(
    EVENT,
    /const netSettlementTotal = computed\(\(\) => netSettlementRows\.value/,
    '送金案の合計を別の計算で出している（表示と食い違う元になる）',
  );
  assert.match(EVENT, /送金案の合計は ¥\{\{ netSettlementTotal\.toLocaleString\(\) \}\}/, '合計が注記に出ていない');
  assert.match(EVENT, /相殺すると実際に動くのはこの額/, 'どちらの数字が実際に動く額か書いていない');
});

test('精算内容の内訳は、出している件数どおりの言い方をする', () => {
  // 「計算の元：4件」はその送金だけの根拠に見えるが、中身はイベント全体の取引。
  assert.doesNotMatch(EVENT_VIEW, /計算の元/, 'その送金だけの根拠に見える言い方に戻っている');
  assert.match(EVENT, /このイベントの計算に使った取引 \{\{ selectedSummary\.details\.length \}\} 件/, '正直な言い方になっていない');
});

test('まとめてタブは、イベントの分が入っていることと外れることを書く', () => {
  assert.match(MONEY, /イベント側でまとめて精算を始めると、そのイベントの分はここから外れて金額が変わります/, '金額が動く理由が書いていない');
  assert.match(MONEY, /const eventPortionByUid = computed/, 'イベント分の内訳を出していない');
  assert.match(MONEY, /\{\{ eventPortionText\(m\.uid\) \}\}/, '内訳が各行に出ていない');
});
