const assert = require("node:assert/strict");
const { test } = require("node:test");
const { calculatePlan } = require("../functions/eventNetSettlement.js");

const makeCase = (balances) => {
  const participants = balances.map((_, index) => ({ id: `P${index}`, name: `P${index}` }));
  const debtors = balances.map((amount, index) => ({ index, amount: -amount })).filter((row) => row.amount > 0);
  const creditors = balances.map((amount, index) => ({ index, amount })).filter((row) => row.amount > 0);
  const transactions = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    transactions.push({
      id: `T${transactions.length}`,
      paidById: participants[debtors[debtorIndex].index].id,
      paidToId: participants[creditors[creditorIndex].index].id,
      amount,
      status: "unpaid",
    });
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount === 0) debtorIndex += 1;
    if (creditors[creditorIndex].amount === 0) creditorIndex += 1;
  }
  return { participants, transactions };
};

test("画面の計算結果と保存時の計算結果が人数や端数にかかわらず一致する", async () => {
  const { buildEventNetSettlement } = await import("../src/lib/eventNetSettlement.js");
  const cases = [
    [-1000, 0, 1000],
    [-1050, 1000, 50],
    [500, -1000, -1100, 600, -800, -900, -700, -1400, 1900, 1100, 1100, 900, -200],
  ];
  let seed = 20260917;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / (2 ** 32));
  for (let sample = 0; sample < 24; sample += 1) {
    const size = 3 + Math.floor(random() * 8);
    const balances = Array.from({ length: size - 1 }, () => {
      const amount = 1 + Math.floor(random() * 2500);
      return random() < 0.5 ? -amount : amount;
    });
    balances.push(-balances.reduce((sum, amount) => sum + amount, 0));
    if (balances.at(-1) !== 0) cases.push(balances);
  }

  for (const balances of cases) {
    const { participants, transactions } = makeCase(balances);
    const preview = buildEventNetSettlement({ participants, transactions });
    const saved = calculatePlan(
      transactions.map((row) => ({ id: row.id, data: () => row })),
      participants.map((row) => row.id),
    );
    assert.deepEqual(saved.transfers, preview.transfers.map(({ fromId, toId, amount }) => ({ fromId, toId, amount })));
  }
});
