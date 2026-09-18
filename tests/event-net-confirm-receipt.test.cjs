const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createEventNetSettlementService } = require("../functions/eventNetSettlement.js");

// 2人・1本の精算。A が B へ 1,000 払う形。
const seed = (legStatus = "unpaid") => ({
  "events/e1": { activeEventSettlementPlanId: "p1", participants: ["A", "B"] },
  "eventSettlementPlans/p1": {
    eventId: "e1", participantIds: ["A", "B"], status: "open", version: 1,
    legIds: ["leg-1"],
    sourceTransactionIds: ["t1"],
    sourceTransactions: [{ id: "t1", paidById: "A", paidToId: "B", amount: 1000 }],
  },
  "eventSettlementPlans/p1/legs/leg-1": {
    fromId: "A", toId: "B", amount: 1000, status: legStatus, sourceTransactionIds: ["t1"],
  },
  "transactions/t1": {
    id: "t1", paidById: "A", paidToId: "B", amount: 1000, status: "unpaid",
    eventId: "e1", eventSettlementPlanId: "p1",
  },
  "users/B": { name: "ビー" },
});

const makeService = (store) => {
  const db = fakeDb(store);
  return { db, service: createEventNetSettlementService({
    db, FieldValue: { serverTimestamp: () => "now", increment: (n) => ({ increment: n }) },
  }) };
};

function fakeDb(initial) {
  const store = new Map(Object.entries(initial));
  const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
  const snapshot = (path) => ({ id: path.split("/").pop(), exists: store.has(path), data: () => clone(store.get(path)) });
  const ref = (path) => ({ path, collection: (name) => coll(`${path}/${name}`) });
  const coll = (path) => ({ path, doc: (id) => ref(`${path}/${id}`) });
  return {
    store,
    collection: coll,
    doc: (path) => ref(path),
    async runTransaction(callback) {
      const writes = [];
      let writing = false;
      const transaction = {
        async get(target) {
          assert.equal(writing, false, "書込みの後に読取りを行わない");
          return snapshot(target.path);
        },
        update(target, patch) { writing = true; writes.push(["update", target.path, clone(patch)]); },
        set(target, value) { writing = true; writes.push(["set", target.path, clone(value)]); },
        create(target, value) { writing = true; writes.push(["set", target.path, clone(value)]); },
        delete(target) { writing = true; writes.push(["delete", target.path]); },
      };
      const result = await callback(transaction);
      for (const [kind, path, value] of writes) {
        if (kind === "delete") store.delete(path);
        else if (kind === "update") store.set(path, { ...store.get(path), ...value });
        else store.set(path, value);
      }
      return result;
    },
  };
}

test("受け取る本人は、相手の報告を待たずに完了にできる", async () => {
  const { db, service } = makeService(seed());
  const out = await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  assert.equal(out.status, "completed");
  assert.equal(out.planStatus, "completed");
  const leg = db.store.get("eventSettlementPlans/p1/legs/leg-1");
  assert.equal(leg.status, "completed");
  assert.equal(leg.confirmedWithoutReport, true, "報告を経ていない印を残す");
  assert.equal(db.store.get("transactions/t1").status, "completed", "元の取引も締める");
  assert.equal(db.store.get("eventSettlementPlans/p1").status, "completed");
  assert.equal(db.store.get("events/e1").activeEventSettlementPlanId, null);
});

test("支払う側は、受け取りを確定できない", async () => {
  const { service } = makeService(seed());
  await assert.rejects(
    service.confirmReceipt("A", { planId: "p1", legId: "leg-1", requestId: "r1" }),
    (e) => e.code === "permission-denied",
  );
});

test("参加者でない人は触れない", async () => {
  const { service } = makeService(seed());
  await assert.rejects(
    service.confirmReceipt("X", { planId: "p1", legId: "leg-1", requestId: "r1" }),
    (e) => e.code === "permission-denied",
  );
});

test("報告済み（承認待ち）の行には使えない。そちらは承認で閉じる", async () => {
  const { service } = makeService(seed("awaiting_approval"));
  await assert.rejects(
    service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" }),
    (e) => e.code === "failed-precondition",
  );
});

test("同じ操作を二度送っても、二重に締めない", async () => {
  const { db, service } = makeService(seed());
  await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  const again = await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  assert.equal(again.replay, true);
  assert.equal(db.store.get("transactions/t1").status, "completed");
});

test("相手に「受け取りを確認した」と知らせる", async () => {
  const { db, service } = makeService(seed());
  await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  const notice = [...db.store.entries()].find(([k]) => k.startsWith("notifications/event-net-received-"));
  assert.ok(notice, "お知らせが作られていない");
  assert.equal(notice[1].toUserId, "A");
  assert.equal(notice[1].fromUserName, "ビー");
  assert.equal(notice[1].amount, 1000);
});

test("元の取引が変わっていたら完了させない", async () => {
  const store = seed();
  store["transactions/t1"].amount = 9999; // 誰かが金額を書き換えた想定
  const { service } = makeService(store);
  await assert.rejects(
    service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" }),
    (e) => e.code === "failed-precondition",
  );
});

// 3人・2本の精算。A が B へ 4,000、A が C へ 1,000。
const seed3 = () => ({
  "events/e1": { activeEventSettlementPlanId: "p1", participants: ["A", "B", "C"] },
  "eventSettlementPlans/p1": {
    eventId: "e1", participantIds: ["A", "B", "C"], status: "open", version: 1,
    legIds: ["leg-1", "leg-2"],
    sourceTransactionIds: ["t1"],
    sourceTransactions: [{ id: "t1", paidById: "A", paidToId: "B", amount: 5000 }],
  },
  "eventSettlementPlans/p1/legs/leg-1": { fromId: "A", toId: "B", amount: 4000, status: "unpaid", sourceTransactionIds: ["t1"] },
  "eventSettlementPlans/p1/legs/leg-2": { fromId: "A", toId: "C", amount: 1000, status: "unpaid", sourceTransactionIds: ["t1"] },
  "transactions/t1": {
    id: "t1", paidById: "A", paidToId: "B", amount: 5000, status: "unpaid",
    eventId: "e1", eventSettlementPlanId: "p1",
    eventSettlementNet: { A: -5000, B: 4000, C: 1000 },
  },
  "users/B": { name: "ビー" },
});

test("自分の行だけ終わったら、その人の差し引きを控えから減らす", async () => {
  // これをしないと、受け取り終わった人のホームに、まだ受け取る額が残って見える
  const { db, service } = makeService(seed3());
  const out = await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  assert.equal(out.planStatus, "open", "残りがあるので精算はまだ終わらない");
  const tx = db.store.get("transactions/t1");
  assert.equal(tx.status, "unpaid", "残りがあるうちは元の取引を締めない");
  assert.deepEqual(tx.eventSettlementNet, { A: -1000, C: 1000 }, "Bのぶんが控えから消える");
});

test("残り1本を終えたら、元の取引も精算も締まる", async () => {
  const { db, service } = makeService(seed3());
  await service.confirmReceipt("B", { planId: "p1", legId: "leg-1", requestId: "r1" });
  await service.confirmReceipt("C", { planId: "p1", legId: "leg-2", requestId: "r2" });
  assert.equal(db.store.get("transactions/t1").status, "completed");
  assert.equal(db.store.get("eventSettlementPlans/p1").status, "completed");
  assert.equal(db.store.get("events/e1").activeEventSettlementPlanId, null);
});
