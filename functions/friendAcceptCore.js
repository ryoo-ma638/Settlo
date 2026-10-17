// フレンド申請の承認をサーバー側で行う。
//
// 以前は画面側が「自分の一覧」と「相手の一覧」の両方へ書いていた。そのためルール上は、
// 申請を送った側が自分で申請を承認済みにし、相手の一覧へ自分を書き込めた（相手の同意なしにフレンドになれた）。
// ここでは「申請を受け取った人（toId）だけが承認できる」ことを確かめてから、
// 両者の friends 文書・承認のお知らせ・申請の削除を1回の書き込みで行う。
// 画面側は requestId を渡すだけで、一覧への書き込みはしない。

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

function createFriendAcceptService({ db, FieldValue }) {
  const now = () => FieldValue.serverTimestamp();

  const profileOf = async (uid, fallbackName) => {
    const snap = await db.collection("users").doc(uid).get();
    const data = snap.exists ? (snap.data() || {}) : {};
    return {
      name: data.name || fallbackName || "名前なし",
      photo: data.photo || data.photoURL || "",
    };
  };

  async function handle(uid, input = {}) {
    if (!uid) fail("unauthenticated", "ログインが必要です。");
    const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
    if (!requestId) fail("invalid-argument", "申請が指定されていません。");

    const reqRef = db.collection("friendRequests").doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) fail("not-found", "この申請は見つかりません。取り消されたか、すでに処理済みです。");
    const req = reqSnap.data() || {};
    if (req.status === "accepted") fail("failed-precondition", "これは承認済みのお知らせで、申請ではありません。");
    if (req.toId !== uid) fail("permission-denied", "この申請を承認できるのは、申請を受け取った人だけです。");
    const friendUid = typeof req.formId === "string" ? req.formId : "";
    if (!friendUid || friendUid === uid) fail("failed-precondition", "この申請には送信者の情報がありません。");

    const me = await profileOf(uid, "名前なし");
    const friend = await profileOf(friendUid, req.formName);
    const friendName = req.formName || friend.name;
    const friendPhoto = req.formPhoto || friend.photo;

    const batch = db.batch();
    // 自分の一覧に相手を、相手の一覧に自分を入れる（項目は画面側が書いていたものと同じ）
    batch.set(db.collection("users").doc(uid).collection("friends").doc(friendUid), {
      uid: friendUid, name: friendName, photo: friendPhoto,
      isFriend: true, isTrading: false, tradeCount: 0, addedAt: now(),
    });
    batch.set(db.collection("users").doc(friendUid).collection("friends").doc(uid), {
      uid, name: me.name, photo: me.photo,
      isFriend: true, isTrading: false, tradeCount: 0, addedAt: now(),
    });
    // 申請した人へ「フレンドになりました」のお知らせ（status: accepted の記録。表示は既存のまま）
    batch.set(db.collection("friendRequests").doc(), {
      toId: friendUid, formId: uid, formName: me.name, formPhoto: me.photo,
      status: "accepted", createdAt: now(),
    });
    batch.delete(reqRef);
    await batch.commit();

    return { ok: true, friendUid, friendName, myName: me.name };
  }

  return { handle };
}

module.exports = { createFriendAcceptService };
