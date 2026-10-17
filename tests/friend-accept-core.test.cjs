// フレンド申請の承認（サーバー側）の確認。
// 見るのは2つ：受け取った人以外は承認できないこと／承認すると両者の一覧・お知らせ・申請の削除が揃うこと。
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createFriendAcceptService } = require("../functions/friendAcceptCore.js");
const { FakeFirestore, FieldValue } = require("./helpers/fake-firestore.cjs");

const seed = () => new FakeFirestore({
  "users/u-to": { name: "受け取る人", photo: "to.png" },
  "users/u-from": { name: "送った人", photoURL: "from.png" },
  "friendRequests/req1": { toId: "u-to", formId: "u-from", formName: "送った人（申請時の名前）", formPhoto: "", status: "pending" },
  "friendRequests/notice1": { toId: "u-from", formId: "u-to", formName: "受け取る人", status: "accepted" },
});
const service = (db) => createFriendAcceptService({ db, FieldValue });
const code = (c) => (e) => e.code === c || e.code === `functions/${c}`;

test("ログインしていないと承認できない", async () => {
  const db = seed();
  await assert.rejects(service(db).handle(null, { requestId: "req1" }), code("unauthenticated"));
  assert.equal(db.writes.length, 0);
});

test("申請が指定されていないと承認できない", async () => {
  const db = seed();
  await assert.rejects(service(db).handle("u-to", {}), code("invalid-argument"));
  await assert.rejects(service(db).handle("u-to", { requestId: "   " }), code("invalid-argument"));
});

test("無い申請は承認できない", async () => {
  const db = seed();
  await assert.rejects(service(db).handle("u-to", { requestId: "nope" }), code("not-found"));
});

test("申請を送った側や無関係な人は承認できない（何も書かれない）", async () => {
  const db = seed();
  await assert.rejects(service(db).handle("u-from", { requestId: "req1" }), code("permission-denied"));
  await assert.rejects(service(db).handle("u-other", { requestId: "req1" }), code("permission-denied"));
  assert.equal(db.writes.length, 0);
  assert.ok(db.get("friendRequests/req1"), "申請は残る");
});

test("承認済みのお知らせ（status: accepted）は申請ではないので承認できない", async () => {
  const db = seed();
  await assert.rejects(service(db).handle("u-from", { requestId: "notice1" }), code("failed-precondition"));
});

test("受け取った人が承認すると、両者の一覧・お知らせ・申請の削除が1回の書き込みで揃う", async () => {
  const db = seed();
  const out = await service(db).handle("u-to", { requestId: "req1" });
  assert.deepEqual(out, { ok: true, friendUid: "u-from", friendName: "送った人（申請時の名前）", myName: "受け取る人" });
  assert.equal(db.commits, 1);

  const mine = db.get("users/u-to/friends/u-from");
  assert.deepEqual(mine, { uid: "u-from", name: "送った人（申請時の名前）", photo: "from.png", isFriend: true, isTrading: false, tradeCount: 0, addedAt: "TS" });
  const theirs = db.get("users/u-from/friends/u-to");
  assert.deepEqual(theirs, { uid: "u-to", name: "受け取る人", photo: "to.png", isFriend: true, isTrading: false, tradeCount: 0, addedAt: "TS" });

  assert.equal(db.get("friendRequests/req1"), undefined, "元の申請は消える");
  const notices = [...db.docs.entries()].filter(([p, d]) => p.startsWith("friendRequests/") && p !== "friendRequests/notice1" && d.status === "accepted" && d.toId === "u-from");
  assert.equal(notices.length, 1, "申請した人への『フレンドになりました』が1件できる");
  assert.equal(notices[0][1].formId, "u-to");
  assert.equal(notices[0][1].formName, "受け取る人");
});

test("申請に名前が無ければ、相手のプロフィールの名前を使う", async () => {
  const db = seed();
  db.docs.set("friendRequests/req2", { toId: "u-to", formId: "u-from", status: "pending" });
  const out = await service(db).handle("u-to", { requestId: "req2" });
  assert.equal(out.friendName, "送った人");
  assert.equal(db.get("users/u-to/friends/u-from").name, "送った人");
});
