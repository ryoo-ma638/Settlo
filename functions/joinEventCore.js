// イベントへの参加をサーバー側で行う。
//
// 以前は「招待コードで探して入る」ために、events をログイン済みなら誰でも読めるようにしていた。
// その結果、公開デモのゲストを含む誰でも、全イベントの名前・参加者・招待コード・総額を一覧でき、
// 鍵なしのイベントへ入れた。ここで招待コードの照合と参加者の追加を行い、
// ルール側は events の読み取りを参加者だけに閉じる。
//
// 入口は2つ。
//   code    … 招待コードで探して参加する（イベント作成画面の「参加する」タブ）
//   eventId … 招待のお知らせ（event_invite）から参加する。本人宛の招待があることを確かめる
// 鍵付き（locked）のイベントは、今までどおりリーダーへ参加リクエストのお知らせを送って待つ。

const fail = (code, message) => {
  let HttpsError = null;
  try {
    ({ HttpsError } = require("firebase-functions/v2/https"));
  } catch {}
  if (HttpsError) throw new HttpsError(code, message);
  const fallback = new Error(message);
  fallback.code = code;
  throw fallback;
};

function createJoinEventService({ db, FieldValue }) {
  const now = () => FieldValue.serverTimestamp();

  const nameOf = async (uid) => {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.exists ? (snap.data() || {}) : {};
    return data.name || "メンバー";
  };

  const findByCode = async (code) => {
    const snap = await db.collection("events").where("invitationCode", "==", code).limit(1).get();
    return snap.empty ? null : snap.docs[0];
  };

  // 本人宛の招待（event_invite）があるか。既読・未読は問わない（招待カードから後で押すこともある）
  const hasInvite = async (uid, eventId) => {
    const snap = await db.collection("notifications")
      .where("toUserId", "==", uid).where("eventId", "==", eventId).where("type", "==", "event_invite")
      .limit(1).get();
    return !snap.empty;
  };

  // 同じイベントへ結果待ちの参加リクエストがあるか（重ねて送らない）
  const hasPendingRequest = async (uid, eventId, leaderUid) => {
    const snap = await db.collection("notifications")
      .where("toUserId", "==", leaderUid).where("fromUserId", "==", uid)
      .where("eventId", "==", eventId).where("type", "==", "event_join_request").where("isRead", "==", false)
      .limit(1).get();
    return !snap.empty;
  };

  async function handle(uid, input = {}) {
    if (!uid) fail("unauthenticated", "ログインが必要です。");
    const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
    const eventId = typeof input.eventId === "string" ? input.eventId.trim() : "";
    const message = typeof input.message === "string" ? input.message.trim().slice(0, 500) : "";
    if (!code && !eventId) fail("invalid-argument", "招待コードかイベントを指定してください。");

    let snap;
    if (code) {
      snap = await findByCode(code);
      if (!snap) return { status: "not_found" };
    } else {
      snap = await db.collection("events").doc(eventId).get();
      if (!snap.exists) return { status: "not_found" };
    }
    const data = snap.data() || {};
    const id = snap.id;
    const eventName = data.name || "";
    const participants = Array.isArray(data.participants) ? data.participants : [];

    if (participants.includes(uid)) return { status: "already", eventId: id, eventName };

    // イベントIDだけで入れると、IDを知っていれば誰でも入れてしまう。招待がある人だけ通す
    if (!code && !(await hasInvite(uid, id))) {
      fail("permission-denied", "このイベントへの招待がありません。招待コードで参加してください。");
    }

    if (data.locked === true && data.leaderUid) {
      if (await hasPendingRequest(uid, id, data.leaderUid)) {
        return { status: "already_requested", eventId: id, eventName };
      }
      await db.collection("notifications").doc().set({
        toUserId: data.leaderUid, type: "event_join_request",
        eventId: id, eventName,
        fromUserId: uid, fromUserName: await nameOf(uid),
        userMessage: message || null,
        isRead: false, createdAt: now(),
      });
      return { status: "request_sent", eventId: id, eventName };
    }

    await snap.ref.update({ participants: FieldValue.arrayUnion(uid) });
    return { status: "joined", eventId: id, eventName };
  }

  return { handle };
}

module.exports = { createJoinEventService };
