// イベント参加（サーバー側）の確認。
// 見るのは3つ：招待コードで入れること／鍵付きはリーダーへのリクエストになること／IDだけでは入れず、招待がある人だけ入れること。
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createJoinEventService } = require("../functions/joinEventCore.js");
const { FakeFirestore, FieldValue } = require("./helpers/fake-firestore.cjs");

const seed = () => new FakeFirestore({
  "users/u-me": { name: "わたし" },
  "events/ev-open": { name: "鍵なしの会", invitationCode: "OPEN01", participants: ["u-owner"], locked: false },
  "events/ev-locked": { name: "鍵付きの会", invitationCode: "LOCK01", participants: ["u-owner"], locked: true, leaderUid: "u-owner" },
  "events/ev-mine": { name: "参加済みの会", invitationCode: "MINE01", participants: ["u-owner", "u-me"] },
  "notifications/inv1": { toUserId: "u-me", type: "event_invite", eventId: "ev-open", isRead: false },
});
const service = (db) => createJoinEventService({ db, FieldValue });
const code = (c) => (e) => e.code === c || e.code === `functions/${c}`;
const requestsTo = (db, leader) => [...db.docs.entries()].filter(([p, d]) => p.startsWith("notifications/") && d.type === "event_join_request" && d.toUserId === leader);

test("ログインしていないと参加できない", async () => {
  await assert.rejects(service(seed()).handle(null, { code: "OPEN01" }), code("unauthenticated"));
});

test("招待コードもイベントも無ければ受け付けない", async () => {
  await assert.rejects(service(seed()).handle("u-me", {}), code("invalid-argument"));
});

test("無い招待コードは not_found（何も書かれない）", async () => {
  const db = seed();
  assert.deepEqual(await service(db).handle("u-me", { code: "NOPE99" }), { status: "not_found" });
  assert.equal(db.writes.length, 0);
});

test("参加済みのイベントは already", async () => {
  const db = seed();
  assert.deepEqual(await service(db).handle("u-me", { code: "MINE01" }), { status: "already", eventId: "ev-mine", eventName: "参加済みの会" });
  assert.equal(db.writes.length, 0);
});

test("鍵なしのイベントは招待コードで参加できる（前後の空白と小文字は直す）", async () => {
  const db = seed();
  const out = await service(db).handle("u-me", { code: "  open01 " });
  assert.deepEqual(out, { status: "joined", eventId: "ev-open", eventName: "鍵なしの会" });
  assert.deepEqual(db.get("events/ev-open").participants, ["u-owner", "u-me"]);
  assert.equal(requestsTo(db, "u-owner").length, 0);
});

test("鍵付きのイベントは参加者に入らず、リーダーへ参加リクエストのお知らせが1件だけ届く", async () => {
  const db = seed();
  const first = await service(db).handle("u-me", { code: "LOCK01", message: "入れてください" });
  assert.deepEqual(first, { status: "request_sent", eventId: "ev-locked", eventName: "鍵付きの会" });
  assert.deepEqual(db.get("events/ev-locked").participants, ["u-owner"], "参加者は増えない");
  const reqs = requestsTo(db, "u-owner");
  assert.equal(reqs.length, 1);
  assert.deepEqual(reqs[0][1], {
    toUserId: "u-owner", type: "event_join_request", eventId: "ev-locked", eventName: "鍵付きの会",
    fromUserId: "u-me", fromUserName: "わたし", userMessage: "入れてください", isRead: false, createdAt: "TS",
  });
  // もう一度押しても重ねて送らない
  const second = await service(db).handle("u-me", { code: "LOCK01" });
  assert.equal(second.status, "already_requested");
  assert.equal(requestsTo(db, "u-owner").length, 1);
});

test("イベントIDだけでは入れない。本人宛の招待がある人だけ入れる", async () => {
  const db = seed();
  await assert.rejects(service(db).handle("u-me", { eventId: "ev-locked" }), code("permission-denied"));
  assert.deepEqual(db.get("events/ev-locked").participants, ["u-owner"]);
  const out = await service(db).handle("u-me", { eventId: "ev-open" });
  assert.equal(out.status, "joined");
  assert.deepEqual(db.get("events/ev-open").participants, ["u-owner", "u-me"]);
});

test("無いイベントIDは not_found", async () => {
  assert.deepEqual(await service(seed()).handle("u-me", { eventId: "ev-none" }), { status: "not_found" });
});
