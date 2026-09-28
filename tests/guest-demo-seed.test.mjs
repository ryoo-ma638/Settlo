import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const code = readFileSync('functions/index.js', 'utf8')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const seed = code.slice(code.indexOf('exports.setupGuestDemo'), code.indexOf('exports.eventNetSettlement'));

test('お試しには、はじめからフレンドが1人いる', () => {
  // フレンドが0人だと「フレンドと割り勘」が空の画面で行き止まりになる
  assert.match(seed, /collection\("friends"\)\.doc\(HANAKO\)/, '自分側にフレンドが入っていない');
  assert.match(seed, /doc\(HANAKO\)\.collection\("friends"\)\.doc\(uid\)/, '相手側にフレンドが入っていない（片側だけ）');
});

test('フレンド申請の体験も残す（別の人から届く）', () => {
  // はじめからフレンドの人からは申請が来ないので、もう一人から届かせる
  const request = seed.slice(seed.indexOf('friendRequests'));
  assert.match(request, /formId: TARO/, '申請が届かない、またはフレンド済みの人から届いている');
});

test('相談が1件届いた状態にする', () => {
  // 空の会話ではAIの返信案が試せない
  assert.match(seed, /threads/, 'チャットを作っていない');
  assert.match(seed, /collection\("messages"\)\.add/, '最初の一言が無い');
});

test('イベントの外にも貸し借りを置く（まとめてが空にならないように）', () => {
  // 全部がイベントの中だと、イベント側の精算を始めたとたん
  // 「まとめて」が「精算できる相手はいません」になって試せなくなる
  const rows = [...seed.matchAll(/collection\("transactions"\)\.add\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  assert.ok(rows.length >= 6, `立て替えが少ない: ${rows.length}`);
  const outside = rows.filter((row) => !/eventId/.test(row));
  assert.equal(outside.length, 2, `イベント外の立て替えが ${outside.length} 件`);
  assert.ok(outside.some((row) => /paidToId: uid/.test(row)), '受け取る分が無い');
  assert.ok(outside.some((row) => /paidById: uid/.test(row)), '支払う分が無い（差し引きが見えない）');
});

// ここから下は、種データの「金額」を実際に精算の計算へ通して確かめる。
// 文字列の形だけ見ても、デモが最後まで進むかどうかは分からないため。
const GUEST = 'guest-uid';
const TARO = 'demo-user-taro';
const HANAKO = 'demo-user-hanako';
const WHO = { uid: GUEST, TARO, HANAKO };
const PARTICIPANTS = [
  { id: GUEST, name: 'ゲスト' },
  { id: TARO, name: 'デモ太郎' },
  { id: HANAKO, name: 'デモ花子' },
];

// 種データの書き方（識別子そのまま）を、計算に渡せる形へ読み替える
const txRows = [...seed.matchAll(/(?:const (\w+) = await )?db\.collection\("transactions"\)\.add\(\{([\s\S]*?)\}\)/g)]
  .map((m, index) => {
    const body = m[2];
    const pick = (key) => {
      const found = new RegExp(`${key}:\\s*([A-Za-z_][A-Za-z0-9_]*)`).exec(body);
      return found ? WHO[found[1]] : null;
    };
    const amount = /amount:\s*(\d+)/.exec(body);
    return {
      id: m[1] || `seed-tx${index + 1}`,
      name: m[1] || null,
      paidById: pick('paidById'),
      paidToId: pick('paidToId'),
      amount: amount ? Number(amount[1]) : 0,
      status: 'unpaid',
      inEvent: /\beventId\b/.test(body),
    };
  });
const txByName = new Map(txRows.filter((row) => row.name).map((row) => [row.name, row]));

const eventRows = txRows.filter((row) => row.inEvent);

// 立て替え履歴（イベントの明細）も同じように読み替える
const histories = [...seed.matchAll(/collection\("history"\)\.add\(\{([\s\S]*?)\n    \}\)/g)].map((m) => {
  const body = m[1];
  return {
    itemName: /itemName:\s*"([^"]+)"/.exec(body)[1],
    payerId: WHO[/payerUid:\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(body)[1]],
    amount: Number(/amount:\s*(\d+),\s*date:/.exec(body)[1]),
    shares: [...body.matchAll(/\{\s*uid(?::\s*([A-Za-z_][A-Za-z0-9_]*))?\s*,[^}]*?amount:\s*(\d+)\s*\}/g)]
      .map((share) => ({ who: share[1] ? WHO[share[1]] : GUEST, amount: Number(share[2]) })),
    transactionIds: [...(/transactionIds:\s*\[([^\]]*)\]/.exec(body)[1]).matchAll(/(\w+)\.id/g)].map((t) => t[1]),
  };
});

test('種データの立て替え履歴を、取りこぼさず読めている', () => {
  // ここが読めていないと、下の2つが「0件を確かめただけ」で通ってしまう
  assert.equal(histories.length, 2, `立て替え履歴が ${histories.length} 件`);
  for (const row of histories) {
    assert.ok(row.payerId && row.amount > 0 && row.shares.length > 0 && row.transactionIds.length > 0,
      `読めない履歴がある: ${JSON.stringify(row)}`);
  }
});

test('種データの誰が誰へ払うかを、取りこぼさず読めている', () => {
  // ここが読めていないと、下の3つが「0件を確かめただけ」で通ってしまう
  assert.ok(eventRows.length >= 4, `イベント内の立て替えが ${eventRows.length} 件`);
  for (const row of eventRows) {
    assert.ok(row.paidById && row.paidToId && row.amount > 0, `読めない行がある: ${JSON.stringify(row)}`);
  }
});

test('送金案が全部ゲスト宛てになる（ゲスト1人で完了まで進める）', async () => {
  // 他人どうしの送金は、ゲストの画面に操作ボタンが出ない（EventDetails の isOthers）。
  // 1本でも混ざると、デモ太郎・花子が動かない展示では精算が open のまま止まる。
  const { buildEventNetSettlement } = await import('../src/lib/eventNetSettlement.js');
  const { transfers } = buildEventNetSettlement({ transactions: eventRows, participants: PARTICIPANTS });
  assert.ok(transfers.length > 0, '送金案が1本も出ていない');
  for (const row of transfers) {
    assert.equal(row.toId, GUEST, `${row.fromId}→${row.toId} はゲスト宛てではない`);
    assert.notEqual(row.fromId, GUEST, 'ゲストからゲストへの送金になっている');
  }
});

test('3人の差し引きの合計が0になる', async () => {
  // 合計が合わないと、精算を始める前に計算が止まる
  const { buildEventNetSettlement } = await import('../src/lib/eventNetSettlement.js');
  const { balances } = buildEventNetSettlement({ transactions: eventRows, participants: PARTICIPANTS });
  const values = Object.values(balances);
  assert.equal(values.reduce((sum, value) => sum + value, 0), 0, `差し引きの合計: ${JSON.stringify(balances)}`);
  assert.ok(balances[GUEST] > 0, 'ゲストが受け取る側になっていない');
});

test('相殺の見本が1人分ある（ゲストへの借りと、ゲストからの受け取りが両方ある人）', () => {
  // 差し引きの意味は、片方向だけの人しかいないと伝わらない
  const owes = new Set(eventRows.filter((row) => row.paidToId === GUEST).map((row) => row.paidById));
  const lends = new Set(eventRows.filter((row) => row.paidById === GUEST).map((row) => row.paidToId));
  const both = [...owes].filter((id) => lends.has(id));
  assert.equal(both.length, 1, `両方ある人が ${both.length} 人`);
});

test('立て替えの総額と、割り当ての合計が合う', () => {
  // 履歴の金額だけ直して合計金額を直し忘れると、イベントの表紙と中身が食い違う
  let totalOfHistories = 0;
  for (const { amount, shares } of histories) {
    assert.equal(shares.length, 3, `割り当てが3人分ない: ${shares.length}`);
    assert.equal(shares.reduce((sum, row) => sum + row.amount, 0), amount, `${amount}円の割り当て合計が合わない`);
    totalOfHistories += amount;
  }
  const total = Number(/totalAmount:\s*(\d+)/.exec(seed)[1]);
  assert.equal(total, totalOfHistories, 'イベントの合計金額が、立て替えの合計と合っていない');
});

test('立て替えの割り当てと、そこから起きる取引の金額が一致する', () => {
  // 履歴だけ直して取引を直し忘れると、明細の数字と精算額が食い違う。
  // 精算の計算は取引しか見ないので、履歴側のずれは画面を見ないと気づけない。
  for (const { itemName, payerId, shares, transactionIds } of histories) {
    const owed = shares.filter((row) => row.who !== payerId);
    assert.equal(transactionIds.length, owed.length, `${itemName}: 取引の数が立て替えを負担する人数と合わない`);
    for (const name of transactionIds) {
      const row = txByName.get(name);
      assert.ok(row, `${itemName}: ${name} を読めない`);
      assert.equal(row.paidToId, payerId, `${itemName}: ${name} の受け取る側が立て替えた人ではない`);
      const share = owed.find((entry) => entry.who === row.paidById);
      assert.ok(share, `${itemName}: ${name} の払う側が割り当てに無い`);
      assert.equal(row.amount, share.amount, `${itemName}: ${name} の金額が割り当てと違う`);
    }
  }
});
