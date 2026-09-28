// ゲスト体験の種データ（functions/index.js setupGuestDemo の tx1〜tx6）を、
// まとめて精算の「開始後」「片方だけ完了」「両方完了」の3状態で画面側へ通す。
//
// 見たいのは途中の状態。送金が1本だけ終わったとき、受け取り終わった人のホームに
// その金額が残らないこと。控え（eventSettlementNet）から自分のキーが消えると
// 画面が額面へ戻してしまい、実際には動かない金額が出ていた。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPaymentOverview, headlineOf } from '../src/lib/paymentOverview.js';
import { friendNetByUid } from '../src/lib/friendBalance.js';
import { calculatePlan, netOfTransfers } from '../functions/eventNetSettlement.js';

const GUEST = 'guest-uid';
const TARO = 'demo-user-taro';
const HANAKO = 'demo-user-hanako';
const PARTICIPANTS = [GUEST, TARO, HANAKO];
const PLAN = 'plan-demo';

// 種データそのまま。tx1〜tx4 がイベント内、tx5・tx6 はイベントの外。
const eventSeed = () => [
  { id: 'tx1', paidById: TARO, paidToId: GUEST, amount: 3000, status: 'unpaid', eventId: 'e1' },
  { id: 'tx2', paidById: HANAKO, paidToId: GUEST, amount: 3000, status: 'unpaid', eventId: 'e1' },
  { id: 'tx3', paidById: GUEST, paidToId: TARO, amount: 1000, status: 'unpaid', eventId: 'e1' },
  { id: 'tx4', paidById: HANAKO, paidToId: TARO, amount: 1000, status: 'unpaid', eventId: 'e1' },
];
const outsideSeed = () => [
  { id: 'tx5', paidById: HANAKO, paidToId: GUEST, amount: 1000, status: 'unpaid' },
  { id: 'tx6', paidById: GUEST, paidToId: HANAKO, amount: 500, status: 'unpaid' },
];

const transfers = calculatePlan(
  eventSeed().map((row) => ({ id: row.id, data: () => row })),
  PARTICIPANTS,
).transfers;

const legOf = (fromId, toId) => {
  const found = transfers.find((row) => row.fromId === fromId && row.toId === toId);
  assert.ok(found, `${fromId}→${toId} の送金が計算されていません`);
  return found;
};

// サーバーが元の取引へ書き込む控えを、完了した送金を除いて作り直す。
// 引数の done は「もう終わった送金」。
const rowsFor = (done = []) => {
  const remaining = transfers.filter((row) => !done.includes(row));
  const net = netOfTransfers(remaining, PARTICIPANTS);
  const finished = remaining.length === 0;
  return [
    ...eventSeed().map((row) => ({
      ...row,
      status: finished ? 'completed' : 'unpaid',
      eventSettlementPlanId: PLAN,
      eventSettlementNet: net,
    })),
    ...outsideSeed(),
  ];
};

const balanceOf = (rows, uid) => {
  const overview = buildPaymentOverview(rows, uid);
  return headlineOf(overview, 'receive').amount - headlineOf(overview, 'pay').amount;
};

test('種データの精算を始めた直後、ゲストの差し引きは +5,500', () => {
  const rows = rowsFor();
  const overview = buildPaymentOverview(rows, GUEST);
  assert.equal(overview.receive.event.amount, 5000, 'イベントで受け取る差し引きは5,000');
  assert.equal(balanceOf(rows, GUEST), 5500);
});

test('送金案は2本とも、ゲストが受け取る向きになっている', () => {
  // 他人どうしの送金があると、ゲストの画面に操作ボタンが出ず完了まで進めない
  assert.equal(transfers.length, 2, `送金が${transfers.length}本`);
  for (const row of transfers) assert.equal(row.toId, GUEST, `${row.fromId}→${row.toId} はゲスト宛てではない`);
});

test('太郎→ゲストの1,000が先に完了したら、ホームにその1,000は残らない', () => {
  const rows = rowsFor([legOf(TARO, GUEST)]);
  const overview = buildPaymentOverview(rows, GUEST);
  assert.equal(overview.receive.event.amount, 4000, '受け取り終わった1,000を引いた残りだけ出す');
  assert.equal(overview.pay.event.amount, 0, '反対側には出さない');
  assert.equal(balanceOf(rows, GUEST), 4500);
});

test('送金が両方とも完了したら、ゲストの差し引きはイベント外の分だけ', () => {
  const rows = rowsFor(transfers);
  const overview = buildPaymentOverview(rows, GUEST);
  assert.equal(overview.receive.event.amount, 0);
  assert.equal(overview.receive.event.items.length, 0, 'イベント行そのものを出さない');
  assert.equal(balanceOf(rows, GUEST), 500);
});

test('太郎が自分の1,000を払い終えたら、太郎のホームに1,000は残らない', () => {
  const rows = rowsFor([legOf(TARO, GUEST)]);
  const overview = buildPaymentOverview(rows, TARO);
  assert.equal(overview.pay.event.amount, 0, '払い終わった1,000を残さない');
  assert.equal(overview.receive.event.amount, 0);
  assert.equal(balanceOf(rows, TARO), 0, 'イベント外の貸し借りは無い');
});

test('まだ終わっていない側の金額は、途中でも変わらない', () => {
  const half = rowsFor([legOf(TARO, GUEST)]);
  assert.equal(buildPaymentOverview(half, HANAKO).pay.event.amount, 4000, '花子は残り4,000を払う');
  assert.equal(buildPaymentOverview(half, GUEST).receive.event.amount, 4000, 'ゲストは4,000を受け取る');
});

// サーバーを直す前に書かれた控えは、終わった人のキーが抜けたまま残っている。
// 関数のデプロイは手作業なので、画面だけ先に新しくなる時間帯がある。
test('自分のキーが抜けた控えでも、取引の額面へ戻さない', () => {
  const rows = rowsFor([legOf(TARO, GUEST)]).map((row) => {
    if (!row.eventSettlementNet) return row;
    const { [TARO]: _removed, ...rest } = row.eventSettlementNet;
    return { ...row, eventSettlementNet: rest };
  });
  const overview = buildPaymentOverview(rows, TARO);
  assert.equal(overview.pay.event.amount, 0, '額面の差し引き2,000を出してしまわない');
  assert.equal(overview.receive.event.amount, 0);
  assert.equal(balanceOf(rows, TARO), 0);
});

test('控えそのものが無い古い精算は、これまでどおり額面から出す', () => {
  const rows = rowsFor().map(({ eventSettlementNet, ...row }) => row);
  const overview = buildPaymentOverview(rows, GUEST);
  assert.equal(overview.receive.event.amount, 5000, '3,000＋3,000−1,000');
  assert.equal(balanceOf(rows, GUEST), 5500);
});

test('イベントの途中経過は、フレンドの差し引きへ混ざらない', () => {
  for (const done of [[], [legOf(TARO, GUEST)], transfers]) {
    const net = friendNetByUid(buildPaymentOverview(rowsFor(done), GUEST));
    assert.equal(net[HANAKO], 500, 'イベント外のコンビニ1,000 − カフェ500');
    assert.equal(net[TARO], undefined, '太郎との貸し借りはイベントの中だけ');
  }
});
