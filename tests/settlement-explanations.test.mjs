// 精算まわりの数字が食い違って見える件は、計算ではなく説明の不足だった。
// 見出し語と注記を戻すと、イベント詳細に「未精算の残り ¥10,000」と
// 送金案の合計 ¥5,000 が説明なしで並ぶ画面に戻るので、言葉そのものを見張る。
// まとめてタブの注記は言葉だけでなく金額も見る。額面を足すと、
// 同じ相手に両方向の取引があるとき行の差し引きより大きくなって新しい食い違いになる。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildPaymentOverview, actionablePaymentItems } from '../src/lib/paymentOverview.js';
import { balancesByPerson, eventPortionByPerson } from '../src/lib/balance.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const EVENT = read('../src/views/EventDetails.vue');
const MONEY = read('../src/views/MoneyPage.vue');
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

test('精算内容の内訳は、いつの取引を出しているかが分かる言い方をする', () => {
  // 「計算の元：4件」はその送金だけの根拠に見えるが、中身はイベント全体の取引。
  assert.doesNotMatch(EVENT_VIEW, /計算の元/, 'その送金だけの根拠に見える言い方に戻っている');
  // 確定済みなどの行は作り直されないので、出せるのは「その行を作ったときの取引」。
  // イベントの最新の全件だと書くと、その行では件数と合わなくなる。
  assert.doesNotMatch(EVENT_VIEW, /このイベントの計算に使った取引/, '最新の全件だと読める言い方になっている');
  assert.match(EVENT, /この送金を作ったときに使った取引 \{\{ selectedSummary\.details\.length \}\} 件/, 'いつの取引か書いていない');
});

test('まとめてタブは、イベントの分が入っていることと外れることを書く', () => {
  assert.match(MONEY, /イベント側でまとめて精算を始めると、そのイベントの分はここから外れて金額が変わります/, '金額が動く理由が書いていない');
  assert.match(MONEY, /eventPortionByPerson\(receivableList\.value, payableList\.value\)/, '行の差し引きと同じ作り方になっていない');
  assert.match(MONEY, /\{\{ eventPortionText\(m\.uid\) \}\}/, '内訳が各行に出ていない');
});

// ---- ここから金額そのものの確認 ----
// functions/index.js の setupGuestDemo が作る6件をそのまま使う。
// ゲストが最初に見る画面なので、ここが合わないまま出荷すると必ず目に触れる。
const GUEST = 'guest-uid';
const TARO = 'demo-user-taro';
const HANAKO = 'demo-user-hanako';
const EVENT_ID = 'event1';
const EVENT_NAME = '札幌旅行（デモ）';
const seed = () => [
  { id: 'tx1', paidById: TARO, paidToId: GUEST, amount: 3000, itemName: 'ジンギスカン夕食', status: 'unpaid', eventId: EVENT_ID, eventName: EVENT_NAME },
  { id: 'tx2', paidById: HANAKO, paidToId: GUEST, amount: 3000, itemName: 'ジンギスカン夕食', status: 'unpaid', eventId: EVENT_ID, eventName: EVENT_NAME },
  { id: 'tx3', paidById: GUEST, paidToId: TARO, amount: 1000, itemName: 'レンタカー', status: 'unpaid', eventId: EVENT_ID, eventName: EVENT_NAME },
  { id: 'tx4', paidById: HANAKO, paidToId: TARO, amount: 1000, itemName: 'レンタカー', status: 'unpaid', eventId: EVENT_ID, eventName: EVENT_NAME },
  { id: 'tx5', paidById: HANAKO, paidToId: GUEST, amount: 1000, itemName: 'コンビニ', status: 'unpaid' },
  { id: 'tx6', paidById: GUEST, paidToId: HANAKO, amount: 500, itemName: 'カフェ代', status: 'unpaid' },
];

// MoneyPage.vue の eventPortionText と同じ文面。画面と同じ言葉で確かめる。
const portionText = (found) => {
  if (!found) return '';
  const where = found.names.length === 1 ? found.names[0] : 'イベント';
  if (found.net === 0) return `${where}の分は差し引き 0 円（${found.count}件）`;
  const side = found.net < 0 ? '支払う' : '受け取る';
  return `${where}の分は ${side} ¥${Math.abs(found.net).toLocaleString()}（${found.count}件）`;
};

const settleTabOf = (transactions, uid) => {
  const mine = transactions.filter((tx) => tx.paidById === uid || tx.paidToId === uid);
  const overview = buildPaymentOverview(mine, uid);
  const receivable = actionablePaymentItems(overview, 'receive');
  const payable = actionablePaymentItems(overview, 'pay');
  return { rows: balancesByPerson(receivable, payable), portions: eventPortionByPerson(receivable, payable) };
};

test('注記の金額は、同じ行に出ている差し引きと同じ向き・同じ単位で出る', () => {
  const { rows, portions } = settleTabOf(seed(), GUEST);
  const taro = rows.find((row) => row.uid === TARO);
  // ゲストから見た太郎：受け取る3,000・支払う1,000 → 差し引きは受け取る2,000
  assert.equal(taro.net, 2000);
  const portion = portions.get(TARO);
  // 額面を足すと4,000になり、行の2,000を追い越して「¥2,000に¥4,000が含まれる」と読める
  assert.equal(portion.net, 2000, '額面を足している（行の差し引きと食い違う）');
  assert.equal(portion.count, 2);
  assert.equal(portionText(portion), '札幌旅行（デモ）の分は 受け取る ¥2,000（2件）');
});

test('注記の分だけ引くと、イベントの精算を始めたあとの差し引きになる', () => {
  const before = settleTabOf(seed(), GUEST);
  // イベントの取引がイベント側の精算へ移った状態（＝まとめてタブから外れる）
  const after = settleTabOf(seed().filter((tx) => !tx.eventId), GUEST);
  for (const row of before.rows) {
    const portion = before.portions.get(row.uid);
    const remain = (row.net || 0) - (portion ? portion.net : 0);
    const found = after.rows.find((next) => next.uid === row.uid);
    assert.equal(remain, found ? found.net : 0, `${row.uid} の注記が外れる分と合っていない`);
  }
  // 太郎の行はイベント分だけなので丸ごと消える。花子はイベント外の500円が残る。
  assert.equal(before.rows.find((row) => row.uid === TARO).net - before.portions.get(TARO).net, 0);
  assert.equal(before.rows.find((row) => row.uid === HANAKO).net - before.portions.get(HANAKO).net, 500);
});

test('支払う側の画面でも、注記は行と同じ向きになる', () => {
  const { rows, portions } = settleTabOf(seed(), TARO);
  const guest = rows.find((row) => row.uid === GUEST);
  assert.equal(guest.net, -2000, '太郎から見るとゲストへ2,000支払う');
  assert.equal(portionText(portions.get(GUEST)), '札幌旅行（デモ）の分は 支払う ¥2,000（2件）');
});
