const assert = require("node:assert/strict");
const { test } = require("node:test");
const { calculateRefreshedPlan, createEventNetSettlementService } = require("../functions/eventNetSettlement.js");

const participants = ["A", "B", "C", "D"];
const tx = (id, paidById, paidToId, amount, eventSettlementPlanId = null) => ({
  id, paidById, paidToId, amount, status: "unpaid", eventSettlementPlanId,
});

test("確定済みの支払いを固定し、未精算分と追加分だけを計算し直す", () => {
  const result = calculateRefreshedPlan({
    participants,
    planId: "plan-1",
    transactions: [
      tx("ab", "A", "B", 1000, "plan-1"),
      tx("dc", "D", "C", 800, "plan-1"),
      tx("bc-new", "B", "C", 1000),
    ],
    legs: [
      { id: "paid-ab", fromId: "A", toId: "B", amount: 1000, status: "completed" },
      { id: "open-dc", fromId: "D", toId: "C", amount: 800, status: "unpaid" },
    ],
  });
  assert.deepEqual(result.fixedLegs.map((row) => row.id), ["paid-ab"]);
  assert.deepEqual(result.transfers, [
    { fromId: "B", toId: "C", amount: 1000 },
    { fromId: "D", toId: "C", amount: 800 },
  ]);
  assert.deepEqual(result.sources.map((row) => row.id).sort(), ["ab", "bc-new", "dc"]);
});

test("受取確認待ちの支払いは組み替えず、追加分を残りへ反映する", () => {
  const result = calculateRefreshedPlan({
    participants,
    planId: "plan-1",
    transactions: [
      tx("ab", "A", "B", 1000, "plan-1"),
      tx("bc-new", "B", "C", 500),
    ],
    legs: [
      { id: "pending-ab", fromId: "A", toId: "B", amount: 1000, status: "awaiting_approval" },
    ],
  });
  assert.deepEqual(result.fixedLegs.map((row) => row.id), ["pending-ab"]);
  assert.deepEqual(result.transfers, [{ fromId: "B", toId: "C", amount: 500 }]);
});

test("受取を確認できなかった支払いは再計算で通常未払いへ置き換えない", () => {
  assert.throws(() => calculateRefreshedPlan({
    participants,
    planId: "plan-1",
    transactions: [
      tx("ab", "A", "B", 1000, "plan-1"),
      tx("bc-new", "B", "C", 500),
    ],
    legs: [
      { id: "review-ab", fromId: "A", toId: "B", amount: 1000, status: "unpaid", reviewRequired: true },
    ],
  }), (error) => error.code === "failed-precondition" && /送金状況を確認/.test(error.message));
});

test("確定済みを差し引いても参加者全員の残額を1円単位で保つ", () => {
  const result = calculateRefreshedPlan({
    participants,
    planId: "plan-1",
    transactions: [
      tx("ab", "A", "B", 1050, "plan-1"),
      tx("bc-new", "B", "C", 50),
    ],
    legs: [{ id: "paid", fromId: "A", toId: "B", amount: 1000, status: "completed" }],
  });
  assert.deepEqual(result.transfers, [{ fromId: "A", toId: "C", amount: 50 }]);
});

const clone = (value) => value === undefined ? undefined : structuredClone(value);

function fakeFirestore(initial) {
  const store = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  const snapshot = (pathName) => {
    const value = store.get(pathName);
    return {
      id: pathName.split("/").at(-1),
      exists: value !== undefined,
      data: () => clone(value),
    };
  };
  const ref = (pathName) => ({
    path: pathName,
    collection: (name) => collection(`${pathName}/${name}`),
  });
  const collection = (pathName) => ({
    path: pathName,
    doc: (id) => ref(`${pathName}/${id}`),
    where: (field, operator, value) => ({ query: true, path: pathName, field, operator, value }),
  });
  return {
    store,
    collection,
    async runTransaction(callback) {
      const writes = [];
      let writing = false;
      const transaction = {
        async get(target) {
          assert.equal(writing, false, "transactionの書込み後に読取りを行わない");
          if (!target.query) return snapshot(target.path);
          const prefix = `${target.path}/`;
          const docs = [...store.entries()]
            .filter(([key, value]) => key.startsWith(prefix)
              && !key.slice(prefix.length).includes("/")
              && value[target.field] === target.value)
            .map(([key]) => snapshot(key));
          return { docs };
        },
        update(target, patch) { writing = true; writes.push(["update", target.path, clone(patch)]); },
        create(target, value) { writing = true; writes.push(["create", target.path, clone(value)]); },
        delete(target) { writing = true; writes.push(["delete", target.path]); },
        set(target, value) { writing = true; writes.push(["set", target.path, clone(value)]); },
      };
      const result = await callback(transaction);
      for (const [kind, pathName, value] of writes) {
        if (kind === "delete") store.delete(pathName);
        else if (kind === "update") store.set(pathName, { ...store.get(pathName), ...value });
        else store.set(pathName, value);
      }
      return result;
    },
  };
}

test("追加分の保存は確定済みを保持し、未精算分だけを差し替えて再送でも増えない", async () => {
  const db = fakeFirestore({
    "events/event-1": { activeEventSettlementPlanId: "plan-1", participants },
    "eventSettlementPlans/plan-1": {
      eventId: "event-1", participantIds: participants, status: "open", version: 1,
      sourceTransactionIds: ["ab", "dc"],
      sourceTransactions: [tx("ab", "A", "B", 1000, "plan-1"), tx("dc", "D", "C", 800, "plan-1")],
      legIds: ["paid-ab", "open-dc"],
    },
    "eventSettlementPlans/plan-1/legs/paid-ab": {
      fromId: "A", toId: "B", amount: 1000, status: "completed", sourceTransactionIds: ["ab", "dc"],
    },
    "eventSettlementPlans/plan-1/legs/open-dc": {
      fromId: "D", toId: "C", amount: 800, status: "unpaid", sourceTransactionIds: ["ab", "dc"],
    },
    "transactions/ab": { ...tx("ab", "A", "B", 1000, "plan-1"), eventId: "event-1" },
    "transactions/dc": { ...tx("dc", "D", "C", 800, "plan-1"), eventId: "event-1" },
    "transactions/bc-new": { ...tx("bc-new", "B", "C", 1000), eventId: "event-1" },
  });
  const service = createEventNetSettlementService({
    db,
    FieldValue: { serverTimestamp: () => "now", increment: (amount) => ({ increment: amount }) },
  });
  const first = await service.refresh("C", { planId: "plan-1", requestId: "refresh-1" });
  assert.equal(first.changed, true);
  assert.equal(db.store.has("eventSettlementPlans/plan-1/legs/open-dc"), false);
  assert.equal(db.store.get("eventSettlementPlans/plan-1/legs/paid-ab").status, "completed");
  assert.equal(db.store.get("transactions/bc-new").eventSettlementPlanId, "plan-1");
  const planAfter = db.store.get("eventSettlementPlans/plan-1");
  assert.equal(planAfter.legIds.length, 3);
  assert.equal(planAfter.legIds[0], "paid-ab");
  const unpaid = planAfter.legIds.slice(1).map((id) => db.store.get(`eventSettlementPlans/plan-1/legs/${id}`));
  assert.deepEqual(unpaid.map((row) => [row.fromId, row.toId, row.amount]).sort(), [
    ["B", "C", 1000],
    ["D", "C", 800],
  ]);
  const second = await service.refresh("A", { planId: "plan-1", requestId: "refresh-1" });
  assert.equal(second.replay, true);
  assert.equal(db.store.get("eventSettlementPlans/plan-1").legIds.length, 3);
});

test("差し戻し後の追加反映は実際の保存処理でも拒否し、元の行を残す", async () => {
  const initial = {
    "events/event-1": { activeEventSettlementPlanId: "plan-1", participants },
    "eventSettlementPlans/plan-1": {
      eventId: "event-1", participantIds: participants, status: "open", version: 2,
      sourceTransactionIds: ["ab"],
      sourceTransactions: [tx("ab", "A", "B", 1000, "plan-1")],
      legIds: ["review-ab"],
    },
    "eventSettlementPlans/plan-1/legs/review-ab": {
      fromId: "A", toId: "B", amount: 1000, status: "unpaid", reviewRequired: true,
      sourceTransactionIds: ["ab"],
    },
    "transactions/ab": { ...tx("ab", "A", "B", 1000, "plan-1"), eventId: "event-1" },
    "transactions/bc-new": { ...tx("bc-new", "B", "C", 500), eventId: "event-1" },
  };
  const db = fakeFirestore(initial);
  const service = createEventNetSettlementService({
    db,
    FieldValue: { serverTimestamp: () => "now", increment: (amount) => ({ increment: amount }) },
  });
  await assert.rejects(
    service.refresh("A", { planId: "plan-1", requestId: "blocked-refresh" }),
    (error) => error.code === "failed-precondition" && /送金状況を確認/.test(error.message),
  );
  assert.deepEqual(db.store.get("eventSettlementPlans/plan-1/legs/review-ab"), initial["eventSettlementPlans/plan-1/legs/review-ab"]);
  assert.equal(db.store.get("transactions/bc-new").eventSettlementPlanId, null);
  assert.deepEqual(db.store.get("eventSettlementPlans/plan-1").legIds, ["review-ab"]);
});
