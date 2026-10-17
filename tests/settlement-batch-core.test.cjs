// 相手ごとのまとめ精算をサーバー側で1回で確定する処理（functions/settlementBatchCore.js）のテスト。
//   実行: node --test tests/settlement-batch-core.test.cjs
//
// 確かめること
//   1. 申請：主側は承認待ち・相殺側は完了になり、内訳が全件に同じ形で付き、お知らせと台帳が同時にできる
//   2. 再送：同じ申請を2回送っても2回目は同じ結果で、書き込みが増えない。内容違いの同じIDは止める
//   3. 画面の内訳と実際の取引が違えば止める。第三者・向き違い・承認待ち・全員精算の予約は申請できない
//   4. 承認・拒否：全件と通知・履歴（byUid付き）・既読を1回で書く。拒否は相殺側も未払いに戻し確認の印を立てる
//   5. 承認後の拒否・拒否後の承認は止める。同じ判断の再送は同じ結果で書き込みが増えない
//   6. 旧形式のバッチ（ID一覧なし・台帳なし）も取引から相殺側を見つけて戻せる。壊れた旧バッチは変更せず止める
//   7. 古い申請IDから新しい申請を操作できない。画面に出していた金額と違えば止める
//   8. 最後の書き込みが失敗したら、取引・お知らせ・履歴・台帳のどれも残らない
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { FakeFirestore, FieldValue } = require("./helpers/fake-firestore.cjs");
const { createSettlementBatchService } = require("../functions/settlementBatchCore.js");

const ME = "u-me", FRIEND = "u-friend", OTHER = "u-other";
const users = { [`users/${ME}`]: { name: "わたし" }, [`users/${FRIEND}`]: { name: "相手" }, [`users/${OTHER}`]: { name: "第三者" } };
const tx = (id, payer, receiver, amount, extra = {}) => ({ [`transactions/${id}`]: { paidById: payer, paidToId: receiver, amount, status: "unpaid", itemName: id, ...extra } });
const make = (seed) => {
  const db = new FakeFirestore({ ...users, ...seed });
  return { db, service: createSettlementBatchService({ db, FieldValue }) };
};
const rejects = (promise, code, part) => assert.rejects(promise, (e) => {
  assert.equal(e.code, code, `code: ${e.code} (${e.message})`);
  if (part) assert.ok(String(e.message).includes(part), `message: ${e.message}`);
  return true;
});
const docsIn = (db, prefix) => [...db.docs.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, d]) => ({ path: p, ...d }));
const expected = (gross, offset, count, counterCount) => ({ gross, offset, net: gross - offset, count, counterCount });

// 自分が払う側：自分が払う2件（500+300）と、相手が自分に払う1件（300）を相殺 → 実質500の承認待ち
const paySeed = () => ({ ...tx("pay-500", ME, FRIEND, 500), ...tx("pay-300", ME, FRIEND, 300), ...tx("recv-300", FRIEND, ME, 300) });
const submitPay = (service, over = {}) => service.handle(ME, {
  action: "submit", batchId: "sb-1", friendUid: FRIEND, direction: "pay",
  transactionIds: ["pay-500", "pay-300", "recv-300"], expected: expected(800, 300, 2, 1), reason: "よろしく", ...over,
});

test("申請（支払う側）：主側は承認待ち・相殺側は完了、内訳・お知らせ・台帳が1回で書かれる", async () => {
  const { db, service } = make(paySeed());
  const result = await submitPay(service);
  assert.equal(result.status, "awaiting_approval");
  assert.equal(result.replay, false);
  assert.deepEqual(result.mainTransactionIds, ["pay-500", "pay-300"]);
  assert.deepEqual(result.counterTransactionIds, ["recv-300"]);
  assert.equal(db.commits, 1);
  const main = db.get("transactions/pay-500"), counter = db.get("transactions/recv-300");
  assert.equal(main.status, "awaiting_approval");
  assert.equal(main.approvalRequestId, "sb-1");
  assert.equal(main.approvalReviewRequired, false);
  assert.equal(counter.status, "completed");
  assert.equal(counter.settlementBatch.role, "offset");
  for (const id of ["pay-500", "pay-300", "recv-300"]) {
    const b = db.get(`transactions/${id}`).settlementBatch;
    assert.deepEqual([b.id, b.gross, b.offset, b.net, b.count, b.counterCount, b.payerUid, b.receiverUid], ["sb-1", 800, 300, 500, 2, 1, ME, FRIEND]);
    assert.deepEqual(b.mainTransactionIds, ["pay-500", "pay-300"]);
    assert.deepEqual(b.counterTransactionIds, ["recv-300"]);
  }
  const notice = db.get("notifications/settlement-batch-sb-1");
  assert.equal(notice.type, "approval_request");
  assert.equal(notice.toUserId, FRIEND);
  assert.equal(notice.fromUserId, ME);
  assert.equal(notice.fromUserName, "わたし");
  assert.equal(notice.amount, 500);
  assert.deepEqual(notice.transactionIds, ["pay-500", "pay-300"]);
  assert.deepEqual(notice.counterTransactionIds, ["recv-300"]);
  assert.equal(notice.batchId, "sb-1");
  assert.equal(notice.approvalRequestId, "sb-1");
  assert.equal(notice.batchGross, 800);
  assert.equal(notice.userMessage, "よろしく");
  const ledger = db.get("settlementRequests/sb-1");
  assert.equal(ledger.kind, "submit");
  assert.equal(ledger.actorUid, ME);
  assert.equal(ledger.status, "awaiting_approval");
});

test("申請（受け取る側）：全件がその場で完了し、相手へ内訳付きの完了通知が届く", async () => {
  const { db, service } = make({ ...tx("recv-1000", FRIEND, ME, 1000), ...tx("pay-200", ME, FRIEND, 200) });
  const result = await service.handle(ME, {
    action: "submit", batchId: "sb-r", friendUid: FRIEND, direction: "remind",
    transactionIds: ["recv-1000", "pay-200"], expected: expected(1000, 200, 1, 1),
  });
  assert.equal(result.status, "completed");
  assert.equal(db.get("transactions/recv-1000").status, "completed");
  assert.equal(db.get("transactions/pay-200").status, "completed");
  assert.equal(db.get("transactions/recv-1000").settlementBatch.role, "main");
  assert.equal(db.get("transactions/pay-200").settlementBatch.role, "offset");
  const notice = db.get("notifications/settlement-batch-sb-r");
  assert.equal(notice.type, "payment_completed");
  assert.equal(notice.toUserId, FRIEND);
  assert.ok(notice.message.includes("2件をまとめて精算しました（対象 ¥1,000・あなたの受け取り ¥200と相殺 → 実質 ¥800）"), notice.message);
  assert.equal(db.commits, 1);
});

test("支払う側なのに相殺のほうが大きい（払う分が無い）選び方は、止めて選び直しへ戻す", async () => {
  const { db, service } = make({ ...tx("recv-300", FRIEND, ME, 300), ...tx("pay-100", ME, FRIEND, 100) });
  await rejects(service.handle(ME, {
    action: "submit", batchId: "sb-neg", friendUid: FRIEND, direction: "pay",
    transactionIds: ["recv-300", "pay-100"], expected: { gross: 100, offset: 300, net: 0, count: 1, counterCount: 1 },
  }), "failed-precondition", "前の画面に戻って");
  assert.equal(db.writes.length, 0);
});

test("再送：同じ申請を2回送ると2回目は同じ結果で、書き込みが増えない。内容違いの同じIDは止める", async () => {
  const { db, service } = make(paySeed());
  const first = await submitPay(service);
  const writes = db.writes.length;
  const second = await submitPay(service);
  assert.equal(second.replay, true);
  assert.equal(second.status, first.status);
  assert.deepEqual(second.mainTransactionIds, first.mainTransactionIds);
  assert.equal(db.writes.length, writes);
  await rejects(submitPay(service, { expected: expected(800, 0, 2, 0), transactionIds: ["pay-500", "pay-300"] }), "failed-precondition", "別の内容");
  assert.equal(db.writes.length, writes);
});

test("画面の内訳と実際の取引が違えば、何も書かずに止める", async () => {
  const { db, service } = make(paySeed());
  await rejects(submitPay(service, { expected: expected(900, 300, 2, 1) }), "failed-precondition", "前の画面に戻って");
  await rejects(submitPay(service, { expected: expected(800, 300, 3, 1) }), "failed-precondition");
  await rejects(submitPay(service, { transactionIds: ["pay-500", "pay-300"] }), "failed-precondition");
  assert.equal(db.writes.length, 0);
});

test("第三者の取引・承認待ち・内訳付き・全員精算の予約・相手が自分は申請できない", async () => {
  const base = paySeed();
  const cases = [
    [{ ...base, ...tx("third", OTHER, FRIEND, 100) }, { transactionIds: ["pay-500", "third"], expected: expected(500, 0, 1, 0) }, "当事者以外"],
    [{ ...base, ...tx("pending", ME, FRIEND, 100, { status: "awaiting_approval" }) }, { transactionIds: ["pending"], expected: expected(100, 0, 1, 0) }, "開き直して"],
    [{ ...base, ...tx("stamped", ME, FRIEND, 100, { settlementBatch: { id: "old" } }) }, { transactionIds: ["stamped"], expected: expected(100, 0, 1, 0) }, "開き直して"],
    [{ ...base, ...tx("reserved", ME, FRIEND, 100, { eventSettlementPlanId: "plan-1" }) }, { transactionIds: ["reserved"], expected: expected(100, 0, 1, 0) }, "全員分のまとめて精算"],
    [{ ...base, ...tx("done", ME, FRIEND, 100, { status: "completed" }) }, { transactionIds: ["done"], expected: expected(100, 0, 1, 0) }, "開き直して"],
  ];
  for (const [seed, over, part] of cases) {
    const { db, service } = make(seed);
    await rejects(submitPay(service, over), "failed-precondition", part);
    assert.equal(db.writes.length, 0, part);
  }
  const { service } = make(paySeed());
  await rejects(submitPay(service, { friendUid: ME }), "invalid-argument");
  await rejects(service.handle(null, { action: "submit" }), "unauthenticated");
  await rejects(submitPay(service, { transactionIds: ["pay-500", "pay-500"] }), "invalid-argument");
});

// 相手（FRIEND）が申請したまとめ精算を、受け取る側の自分（ME）が承認・拒否する
const requestSeed = async () => {
  const { db, service } = make({ ...tx("f-500", FRIEND, ME, 500), ...tx("f-300", FRIEND, ME, 300), ...tx("m-300", ME, FRIEND, 300) });
  await service.handle(FRIEND, {
    action: "submit", batchId: "sb-2", friendUid: ME, direction: "pay",
    transactionIds: ["f-500", "f-300", "m-300"], expected: expected(800, 300, 2, 1),
  });
  db.writes.length = 0;
  db.commits = 0;
  return { db, service };
};
const decideBatch = (service, decision, over = {}) => service.handle(ME, {
  action: "decide", decision, items: [{ id: "f-500", requestId: "sb-2" }, { id: "f-300", requestId: "sb-2" }],
  notificationId: "settlement-batch-sb-2", expectedAmount: 500, ...over,
});

test("承認：主側全件が完了し、相殺側はそのまま。完了通知・履歴2行（byUid）・既読・台帳が1回で書かれる", async () => {
  const { db, service } = await requestSeed();
  const result = await decideBatch(service, "approved");
  assert.equal(result.replay, false);
  assert.deepEqual(result.transactionIds, ["f-500", "f-300"]);
  assert.deepEqual(result.counterTransactionIds, []);
  assert.equal(db.commits, 1);
  assert.equal(db.get("transactions/f-500").status, "completed");
  assert.equal(db.get("transactions/f-300").status, "completed");
  assert.equal(db.get("transactions/f-500").settlementBatch.id, "sb-2", "内訳は記録として残す");
  assert.equal(db.get("transactions/m-300").status, "completed");
  const notice = db.get("notifications/settlement-decision-sb-2-approved");
  assert.equal(notice.type, "payment_completed");
  assert.equal(notice.toUserId, FRIEND);
  assert.equal(notice.amount, 500);
  assert.ok(notice.message.includes("2件の精算が承認され"), notice.message);
  assert.equal(db.get("notifications/settlement-batch-sb-2").isRead, true, "押した承認リクエストは既読");
  const history = docsIn(db, "approvalHistory/");
  assert.equal(history.length, 2);
  assert.deepEqual(history.map((h) => [h.userId, h.role, h.outcome, h.amount, h.byUid]).sort(), [[FRIEND, "toMe", "approved", 500, ME], [ME, "byMe", "approved", 500, ME]].sort());
  assert.equal(history.find((h) => h.role === "byMe").otherName, "相手");
  assert.equal(history.find((h) => h.role === "toMe").otherName, "わたし");
  const ledger = db.get("settlementRequests/sb-2");
  assert.equal(ledger.decision, "approved");
  assert.equal(ledger.decidedBy, ME);
  assert.equal(ledger.kind, "submit", "申請時の台帳に判断を足す");
});

test("拒否：主側も相殺側も未払いへ戻り、内訳が消えて確認の印が立つ。通知は双方向の文面", async () => {
  const { db, service } = await requestSeed();
  const result = await decideBatch(service, "rejected", { reason: "まだ受け取っていません" });
  assert.deepEqual(result.transactionIds, ["f-500", "f-300"]);
  assert.deepEqual(result.counterTransactionIds, ["m-300"]);
  for (const id of ["f-500", "f-300", "m-300"]) {
    const row = db.get(`transactions/${id}`);
    assert.equal(row.status, "unpaid", id);
    assert.equal(row.settlementBatch, null, id);
    assert.equal(row.approvalReviewRequired, true, id);
    assert.equal(row.approvalRequestId, null, id);
  }
  const notice = db.get("notifications/settlement-decision-sb-2-rejected");
  assert.equal(notice.type, "approval_rejected");
  assert.ok(notice.message.includes("双方向の精算がすべて未払いに戻っています"), notice.message);
  assert.deepEqual(notice.counterTransactionIds, ["m-300"]);
  assert.equal(notice.userMessage, "まだ受け取っていません");
  assert.equal(docsIn(db, "approvalHistory/").filter((h) => h.outcome === "rejected").length, 2);
  assert.equal(db.commits, 1);
});

test("承認後の拒否・拒否後の承認は止める。同じ判断の再送は同じ結果で書き込みが増えない", async () => {
  const approved = await requestSeed();
  await decideBatch(approved.service, "approved");
  const writes = approved.db.writes.length;
  const again = await decideBatch(approved.service, "approved");
  assert.equal(again.replay, true);
  assert.deepEqual(again.transactionIds, ["f-500", "f-300"]);
  assert.equal(approved.db.writes.length, writes);
  await rejects(decideBatch(approved.service, "rejected"), "failed-precondition", "すでに承認");
  assert.equal(approved.db.writes.length, writes);

  const rejected = await requestSeed();
  await decideBatch(rejected.service, "rejected");
  const rw = rejected.db.writes.length;
  await rejects(decideBatch(rejected.service, "approved"), "failed-precondition", "すでに拒否");
  const replay = await decideBatch(rejected.service, "rejected");
  assert.equal(replay.replay, true);
  assert.deepEqual(replay.counterTransactionIds, ["m-300"]);
  assert.equal(rejected.db.writes.length, rw);
});

test("申請者本人や第三者は承認できない。画面に出していた金額と違えば止める", async () => {
  const { db, service } = await requestSeed();
  await rejects(service.handle(FRIEND, { action: "decide", decision: "approved", items: [{ id: "f-500", requestId: "sb-2" }] }), "failed-precondition");
  await rejects(service.handle(OTHER, { action: "decide", decision: "approved", items: [{ id: "f-500", requestId: "sb-2" }] }), "failed-precondition");
  await rejects(decideBatch(service, "approved", { expectedAmount: 800 }), "failed-precondition", "開き直して");
  assert.equal(db.writes.length, 0);
});

test("古い申請IDから新しい申請を承認・拒否できない（主側1件だけ渡しても、まとめ全体を扱う）", async () => {
  const { db, service } = await requestSeed();
  await rejects(decideBatch(service, "rejected", { items: [{ id: "f-500", requestId: "sb-old" }] }), "failed-precondition", "開き直して");
  await rejects(decideBatch(service, "rejected", { items: [{ id: "f-500", requestId: null }] }), "failed-precondition");
  assert.equal(db.writes.length, 0);
  // チャット画面のように主側1件だけ渡しても、同じまとめの全件が対象になる
  const result = await service.handle(ME, { action: "decide", decision: "rejected", items: [{ id: "f-300", requestId: "sb-2" }] });
  assert.deepEqual(result.transactionIds, ["f-500", "f-300"]);
  assert.deepEqual(result.counterTransactionIds, ["m-300"]);
});

test("旧形式のバッチ（ID一覧なし・台帳なし）も、取引から相殺側を見つけて全件戻せる", async () => {
  const legacy = { id: "legacy-1", gross: 800, offset: 300, net: 500, count: 2, counterCount: 1, payerUid: FRIEND, receiverUid: ME };
  const { db, service } = make({
    ...tx("l-500", FRIEND, ME, 500, { status: "awaiting_approval", settlementBatch: { ...legacy, role: "main" } }),
    ...tx("l-300", FRIEND, ME, 300, { status: "awaiting_approval", settlementBatch: { ...legacy, role: "main" } }),
    ...tx("l-c300", ME, FRIEND, 300, { status: "completed", settlementBatch: { ...legacy, role: "offset" } }),
    ...tx("unrelated", ME, FRIEND, 100, { status: "completed" }),
    "notifications/old-req": { toUserId: ME, fromUserId: FRIEND, type: "approval_request", isRead: false, transactionIds: ["l-500", "l-300"], batchId: "legacy-1", amount: 500 },
  });
  const result = await service.handle(ME, {
    action: "decide", decision: "rejected", items: [{ id: "l-500", requestId: "legacy-1" }, { id: "l-300", requestId: "legacy-1" }], notificationId: "old-req",
  });
  assert.deepEqual(result.counterTransactionIds, ["l-c300"]);
  assert.equal(db.get("transactions/l-c300").status, "unpaid");
  assert.equal(db.get("transactions/l-c300").approvalReviewRequired, true);
  assert.equal(db.get("transactions/unrelated").status, "completed", "関係ない取引には触らない");
  assert.equal(db.get("notifications/old-req").isRead, true);
  assert.equal(db.get("settlementRequests/legacy-1").kind, "legacy-batch");
  // 旧形式でも、同じ判断の再送は台帳から同じ結果を返し、別の判断は止める（取引からは内訳が消えていても台帳で分かる）
  const writes = db.writes.length;
  const again = await service.handle(ME, { action: "decide", decision: "rejected", items: [{ id: "l-500", requestId: "legacy-1" }] });
  assert.equal(again.replay, true);
  assert.deepEqual(again.transactionIds, ["l-500", "l-300"]);
  assert.deepEqual(again.counterTransactionIds, ["l-c300"]);
  assert.equal(db.writes.length, writes);
  await rejects(service.handle(ME, { action: "decide", decision: "approved", items: [{ id: "l-500", requestId: "legacy-1" }] }), "failed-precondition", "すでに拒否");
});

test("壊れた旧バッチ（相殺側が足りない・内訳が食い違う・一部だけ完了）は変更せずに止める", async () => {
  const legacy = { id: "b-1", gross: 800, offset: 300, net: 500, count: 2, counterCount: 1, payerUid: FRIEND, receiverUid: ME };
  const rows = (over = {}) => ({
    ...tx("b-500", FRIEND, ME, 500, { status: "awaiting_approval", settlementBatch: { ...legacy, role: "main" }, ...(over["b-500"] || {}) }),
    ...tx("b-300", FRIEND, ME, 300, { status: "awaiting_approval", settlementBatch: { ...legacy, role: "main" }, ...(over["b-300"] || {}) }),
    ...(over.noCounter ? {} : tx("b-c300", ME, FRIEND, 300, { status: "completed", settlementBatch: { ...legacy, role: "offset", ...(over.counterBatch || {}) } })),
  });
  const cases = [
    ["相殺側が足りない", rows({ noCounter: true })],
    ["内訳が食い違う", rows({ counterBatch: { net: 400 } })],
    ["一部だけ完了", rows({ "b-300": { status: "completed" } })],
    ["金額が内訳と違う", rows({ "b-300": { amount: 350 } })],
  ];
  for (const [label, seed] of cases) {
    const { db, service } = make(seed);
    await rejects(service.handle(ME, { action: "decide", decision: "approved", items: [{ id: "b-500", requestId: "b-1" }, { id: "b-300", requestId: "b-1" }] }), "failed-precondition", "選び直して");
    assert.equal(db.writes.length, 0, label);
  }
});

test("単発の申請：承認・拒否も同じ鍵の考え方。受け取る側だけができ、再送は同じ結果、別の判断は止まる", async () => {
  const { db, service } = make({
    ...tx("s-1", FRIEND, ME, 1200, { status: "awaiting_approval", approvalRequestId: "sr-1", eventName: "架空の会" }),
    ...tx("s-legacy", FRIEND, ME, 800, { status: "awaiting_approval" }),
    "notifications/n-s1": { toUserId: ME, fromUserId: FRIEND, type: "approval_request", isRead: false, transactionId: "s-1", approvalRequestId: "sr-1", amount: 1200 },
  });
  await rejects(service.handle(FRIEND, { action: "decide", decision: "approved", items: [{ id: "s-1", requestId: "sr-1" }] }), "failed-precondition", "受け取る側");
  const result = await service.handle(ME, { action: "decide", decision: "approved", items: [{ id: "s-1", requestId: "sr-1" }], expectedAmount: 1200 });
  assert.equal(db.get("transactions/s-1").status, "completed");
  assert.equal(db.get("notifications/n-s1").isRead, true);
  const notice = db.get("notifications/settlement-decision-sr-1-approved");
  assert.equal(notice.type, "payment_completed");
  assert.equal(notice.eventName, "架空の会");
  assert.equal(notice.itemName, "s-1");
  assert.equal(docsIn(db, "approvalHistory/").length, 2);
  const writes = db.writes.length;
  const again = await service.handle(ME, { action: "decide", decision: "approved", items: [{ id: "s-1", requestId: "sr-1" }] });
  assert.equal(again.replay, true);
  assert.equal(db.writes.length, writes);
  await rejects(service.handle(ME, { action: "decide", decision: "rejected", items: [{ id: "s-1", requestId: "sr-1" }] }), "failed-precondition", "すでに承認");
  // 申請IDの無い古い取引は、取引IDを鍵にして同じように扱える
  const legacy = await service.handle(ME, { action: "decide", decision: "rejected", items: [{ id: "s-legacy", requestId: null }] });
  assert.equal(legacy.status, "unpaid");
  assert.equal(db.get("transactions/s-legacy").approvalReviewRequired, true);
  assert.equal(db.get("settlementRequests/legacy-s-legacy").decision, "rejected");
  assert.equal(result.replay, false);
});

test("旧画面で再申請された単発は別の回として扱い、前回の判断の台帳に引きずられない", async () => {
  const { db, service } = make({ ...tx("s-2", FRIEND, ME, 400, { status: "awaiting_approval" }) });
  await service.handle(ME, { action: "decide", decision: "rejected", items: [{ id: "s-2", requestId: null }] });
  // 相手が（申請IDを付けない古い画面で）もう一度支払い報告した
  db.docs.set("transactions/s-2", { ...db.get("transactions/s-2"), status: "awaiting_approval", approvalReviewRequired: false });
  const result = await service.handle(ME, { action: "decide", decision: "approved", items: [{ id: "s-2", requestId: null }] });
  assert.equal(result.replay, false);
  assert.equal(db.get("transactions/s-2").status, "completed");
});

test("最後の書き込みが失敗したら、取引・お知らせ・履歴・台帳のどれも残らない", async () => {
  const { db, service } = await requestSeed();
  db.failWrites = (op, path) => path.startsWith("approvalHistory/");
  await assert.rejects(decideBatch(service, "approved"), /simulated write failure/);
  assert.equal(db.get("transactions/f-500").status, "awaiting_approval");
  assert.equal(db.get("notifications/settlement-batch-sb-2").isRead, false);
  assert.equal(db.get("notifications/settlement-decision-sb-2-approved"), undefined);
  assert.equal(db.get("settlementRequests/sb-2").decision, undefined);
  assert.equal(docsIn(db, "approvalHistory/").length, 0);
  assert.equal(db.commits, 0);
  db.failWrites = null;
  const { db: db2, service: service2 } = make(paySeed());
  db2.failWrites = (op, path) => path.startsWith("notifications/");
  await assert.rejects(submitPay(service2), /simulated write failure/);
  assert.equal(db2.get("transactions/pay-500").status, "unpaid");
  assert.equal(db2.get("transactions/pay-500").settlementBatch, undefined);
  assert.equal(db2.get("settlementRequests/sb-1"), undefined);
});
