const assert = require("node:assert/strict");
const path = require("node:path");
const { test, after } = require("node:test");
const { Module, createRequire } = require("node:module");

const mainFunctions = path.resolve(__dirname, "../functions");
process.env.NODE_PATH = path.join(mainFunctions, "node_modules");
Module._initPaths();
const requireFromFunctions = createRequire(path.join(mainFunctions, "package.json"));
const admin = requireFromFunctions("firebase-admin");
const { createEventNetSettlementService } = require("../functions/eventNetSettlement.js");

const projectId = process.env.EVENT_NET_FUNCTIONS_PROJECT || "demo-settlo-event-net-functions";
const port = process.env.EVENT_NET_FUNCTIONS_PORT || "8093";
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${port}`;

const app = admin.initializeApp({ projectId }, `event-net-functions-${Date.now()}`);
const db = app.firestore();
const service = createEventNetSettlementService({
  db,
  FieldValue: admin.firestore.FieldValue,
});

after(async () => {
  await app.delete();
});

const seed = async () => {
  const batch = db.batch();
  batch.set(db.doc("events/event-1"), {
    name: "3人旅行",
    participants: ["A", "B", "C"],
  });
  batch.set(db.doc("transactions/ab"), {
    eventId: "event-1", paidById: "A", paidToId: "B", amount: 1000, status: "unpaid", itemName: "宿",
  });
  batch.set(db.doc("transactions/ca"), {
    eventId: "event-1", paidById: "C", paidToId: "A", amount: 500, status: "unpaid", itemName: "食事",
  });
  await batch.commit();
};

test("参加者確認、作成と元取引予約を1回のtransactionで行う", async () => {
  await seed();
  await assert.rejects(
    service.start("outsider", { eventId: "event-1", requestId: "start-1" }),
    (error) => error.code === "permission-denied",
  );

  const created = await service.start("A", { eventId: "event-1", requestId: "start-1" });
  assert.equal(created.legCount, 2);
  const plan = await db.doc(`eventSettlementPlans/${created.planId}`).get();
  assert.equal(plan.data().status, "open");
  assert.deepEqual(plan.data().sourceTransactionIds.sort(), ["ab", "ca"]);
  assert.equal((await db.doc("transactions/ab").get()).data().eventSettlementPlanId, created.planId);
  assert.equal((await db.doc("transactions/ca").get()).data().eventSettlementPlanId, created.planId);
  assert.equal((await db.doc("events/event-1").get()).data().activeEventSettlementPlanId, created.planId);
});

test("作成の再送は同じplanを返し、別の開始要求も進行中planを再利用する", async () => {
  const first = await service.start("A", { eventId: "event-1", requestId: "start-1" });
  const replay = await service.start("A", { eventId: "event-1", requestId: "start-1" });
  const other = await service.start("B", { eventId: "event-1", requestId: "start-2" });
  assert.equal(replay.planId, first.planId);
  assert.equal(replay.replay, true);
  assert.equal(other.planId, first.planId);
  assert.equal(other.alreadyActive, true);
  const plans = await db.collection("eventSettlementPlans").get();
  assert.equal(plans.size, 1);
});

test("第三者を拒否し、同じ支払い報告の再送で通知を増やさない", async () => {
  const planId = (await db.doc("events/event-1").get()).data().activeEventSettlementPlanId;
  const legs = await db.collection(`eventSettlementPlans/${planId}/legs`).get();
  const aLeg = legs.docs.find((snap) => snap.data().fromId === "A");
  await assert.rejects(
    service.report("C", { planId, legId: aLeg.id, requestId: "pay-a-1" }),
    (error) => error.code === "permission-denied",
  );
  const first = await service.report("A", { planId, legId: aLeg.id, requestId: "pay-a-1" });
  const replay = await service.report("A", { planId, legId: aLeg.id, requestId: "pay-a-1" });
  assert.equal(first.status, "awaiting_approval");
  assert.equal(replay.replay, true);
  const notices = await db.collection("notifications").where("planId", "==", planId).get();
  assert.equal(notices.size, 1);
});

test("1行だけ承認しても元取引は完了せず、全行承認時だけ完了する", async () => {
  const planId = (await db.doc("events/event-1").get()).data().activeEventSettlementPlanId;
  const legs = await db.collection(`eventSettlementPlans/${planId}/legs`).get();
  const aLeg = legs.docs.find((snap) => snap.data().fromId === "A");
  const cLeg = legs.docs.find((snap) => snap.data().fromId === "C");

  await assert.rejects(
    service.decide("C", { planId, legId: aLeg.id, requestId: "pay-a-1", decision: "approved" }),
    (error) => error.code === "permission-denied",
  );
  const firstApproval = await service.decide("B", {
    planId, legId: aLeg.id, requestId: "pay-a-1", decision: "approved",
  });
  assert.equal(firstApproval.planStatus, "open");
  assert.equal((await db.doc("transactions/ab").get()).data().status, "unpaid");

  await service.report("C", { planId, legId: cLeg.id, requestId: "pay-c-1" });
  const rejected = await service.decide("B", {
    planId, legId: cLeg.id, requestId: "pay-c-1", decision: "rejected",
  });
  assert.equal(rejected.status, "unpaid");
  const rejectedReplay = await service.decide("B", {
    planId, legId: cLeg.id, requestId: "pay-c-1", decision: "rejected",
  });
  assert.equal(rejectedReplay.replay, true);
  assert.equal((await cLeg.ref.get()).data().reviewRequired, true);

  await service.report("C", { planId, legId: cLeg.id, requestId: "pay-c-2" });
  const completed = await service.decide("B", {
    planId, legId: cLeg.id, requestId: "pay-c-2", decision: "approved",
  });
  assert.equal(completed.planStatus, "completed");
  assert.equal((await db.doc("transactions/ab").get()).data().status, "completed");
  assert.equal((await db.doc("transactions/ca").get()).data().status, "completed");
  assert.equal((await db.doc("events/event-1").get()).data().activeEventSettlementPlanId, null);
  assert.equal((await db.doc("events/event-1").get()).data().lastEventSettlementPlanId, planId);
  const approvalReplay = await service.decide("B", {
    planId, legId: cLeg.id, requestId: "pay-c-2", decision: "approved",
  });
  assert.equal(approvalReplay.replay, true);
});

test("確定済みを残し、追加された取引を未精算分へ安全に組み込む", async () => {
  const batch = db.batch();
  batch.set(db.doc("events/event-refresh"), { participants: ["A", "B", "C", "D"] });
  batch.set(db.doc("transactions/refresh-ab"), {
    eventId: "event-refresh", paidById: "A", paidToId: "B", amount: 1000, status: "unpaid",
  });
  batch.set(db.doc("transactions/refresh-dc"), {
    eventId: "event-refresh", paidById: "D", paidToId: "C", amount: 800, status: "unpaid",
  });
  await batch.commit();
  const started = await service.start("A", { eventId: "event-refresh", requestId: "refresh-start" });
  let legs = await db.collection(`eventSettlementPlans/${started.planId}/legs`).get();
  const paidLeg = legs.docs.find((snap) => snap.data().fromId === "A");
  await service.report("A", { planId: started.planId, legId: paidLeg.id, requestId: "refresh-paid" });
  await service.decide("B", {
    planId: started.planId, legId: paidLeg.id, requestId: "refresh-paid", decision: "approved",
  });
  await db.doc("transactions/refresh-new").set({
    eventId: "event-refresh", paidById: "B", paidToId: "C", amount: 1000, status: "unpaid",
  });
  const refreshed = await service.refresh("C", { planId: started.planId, requestId: "refresh-1" });
  assert.equal(refreshed.changed, true);
  assert.equal((await db.doc("transactions/refresh-new").get()).data().eventSettlementPlanId, started.planId);
  legs = await db.collection(`eventSettlementPlans/${started.planId}/legs`).get();
  const rows = legs.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
  const fixedRow = rows.find((row) => row.id === paidLeg.id);
  assert.equal(fixedRow.status, "completed");
  assert.equal(fixedRow.sourceTransactionIds.includes("refresh-new"), false);
  assert.deepEqual(rows.filter((row) => row.status === "unpaid").map((row) => [row.fromId, row.toId, row.amount]).sort(), [
    ["B", "C", 1000],
    ["D", "C", 800],
  ]);
  assert.ok(rows.filter((row) => row.status === "unpaid").every((row) => row.sourceTransactionIds.includes("refresh-new")));
  const replay = await service.refresh("A", { planId: started.planId, requestId: "refresh-1" });
  assert.equal(replay.replay, true);
  assert.equal((await db.collection(`eventSettlementPlans/${started.planId}/legs`).get()).size, 3);
});
