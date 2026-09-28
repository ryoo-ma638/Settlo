// 控え（eventSettlementNet）を作る netOfTransfers だけを見るテスト。
// 送金が1本だけ終わった途中の状態でも、参加者全員のキーが残ることを確かめる。
// キーが消えると画面が「控えの無い古い精算」と誤認して額面へ戻し、
// 受け取り終わった人のホームに、実際には動かない金額が残って見える。
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { netOfTransfers } = require("../functions/eventNetSettlement.js");

const transfer = (fromId, toId, amount) => ({ fromId, toId, amount });

test("送金から参加者ごとの差し引きを作る", () => {
  const net = netOfTransfers([transfer("A", "B", 4000), transfer("A", "C", 1000)], ["A", "B", "C"]);
  assert.deepEqual(net, { A: -5000, B: 4000, C: 1000 });
});

test("終わった送金を除いても、その人のキーは0で残る", () => {
  // A→B 4,000 と A→C 1,000 のうち、A→C だけ終わった状態
  const net = netOfTransfers([transfer("A", "B", 4000)], ["A", "B", "C"]);
  assert.deepEqual(net, { A: -4000, B: 4000, C: 0 });
  assert.equal(net.C, 0, "受け取り終わった C のキーが消えない");
});

test("残りが1本も無ければ、全員0になる", () => {
  assert.deepEqual(netOfTransfers([], ["A", "B", "C"]), { A: 0, B: 0, C: 0 });
});

test("参加者に入っていない人が送金にいても、その分は数える", () => {
  // 参加者の取り違えで金額を落とさないよう、送金側を優先する
  const net = netOfTransfers([transfer("A", "D", 300)], ["A", "B"]);
  assert.deepEqual(net, { A: -300, B: 0, D: 300 });
});

test("参加者が渡されない古い呼び出しでも、送金から作れる", () => {
  assert.deepEqual(netOfTransfers([transfer("A", "B", 100)]), { A: -100, B: 100 });
});

test("空の参加者IDは控えに入れない", () => {
  assert.deepEqual(netOfTransfers([], ["A", "", null, undefined]), { A: 0 });
});
