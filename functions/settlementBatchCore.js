// 相手ごとのまとめ精算（支払い画面の「まとめて」）を、対象の取引全件・お知らせ・承認履歴まで1回で確定する。
//
// なぜサーバー側か
//   画面が取引を1件ずつ書いていた頃は、途中で電波が切れると「片側だけ完了」「内訳なし」「通知だけ」が残った。
//   ここでは Firestore のトランザクションでまとめて書き、途中で止まれば何も残さない。
//   同じ要求を2回受け取っても（通信の再送）、2回目は同じ結果を返すだけで書き込みを増やさない。
//
// 使い方：createSettlementBatchService({ db, FieldValue }).handle(uid, input)
//   input.action = 'submit'（申請・受け取りの確定） | 'decide'（承認・拒否）
//   本人確認は呼び出し元の認証情報（uid）だけを信用し、画面が渡すUIDは使わない。
//
// 記録の形（画面側と同じ）
//   transactions/{id}.settlementBatch = { id, gross, offset, net, count, counterCount, payerUid, receiverUid,
//                                        mainTransactionIds, counterTransactionIds, role: 'main' | 'offset' }
//   settlementRequests/{申請ID}         = 再送を見分けるための台帳（画面からは読めない・書けない）

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

const PENDING = "awaiting_approval";
const STALE = "支払い状況が変わっています。画面を開き直して確認してください。";
const BROKEN = "この精算は確定できません。支払い画面の「まとめて」から対象を選び直してください。";
const MISMATCH = "金額や対象が変わっています。前の画面に戻って選び直してください。";
const BREAKDOWN_KEYS = ["gross", "offset", "net", "count", "counterCount"];
const SHARED_KEYS = ["id", "gross", "offset", "net", "count", "counterCount", "payerUid", "receiverUid"];

const asCount = (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const assertId = (value, label) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail("invalid-argument", `${label}が正しくありません。`);
  return value;
};
const uniqueIds = (list, label) => {
  if (!Array.isArray(list) || list.length === 0 || list.length > 100) fail("invalid-argument", `${label}がありません。`);
  const ids = list.map((v) => assertId(v, label));
  if (new Set(ids).size !== ids.length) fail("invalid-argument", `${label}が重複しています。`);
  return ids;
};
const noteOf = (value) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : null);
const sumOf = (rows) => rows.reduce((s, r) => s + r.amount, 0);
const sameSet = (a, b) => {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const yenText = (n) => `¥${Number(n).toLocaleString("ja-JP")}`;

function createSettlementBatchService({ db, FieldValue }) {
  const now = () => FieldValue.serverTimestamp();
  const txRef = (id) => db.collection("transactions").doc(id);
  const ledgerRef = (key) => db.collection("settlementRequests").doc(key);

  const readRows = async (transaction, ids) => {
    const snaps = await Promise.all(ids.map((id) => transaction.get(txRef(id))));
    return snaps.map((snap, i) => {
      if (!snap.exists) fail("failed-precondition", STALE);
      return { id: ids[i], ...snap.data() };
    });
  };
  const nameOf = async (transaction, uid, fallback) => {
    const snap = await transaction.get(db.collection("users").doc(uid));
    return snap.exists ? (snap.data().name || fallback) : fallback;
  };

  // 取引1件の最低限の確認：全員精算の予約がない／金額が読める／当事者2人の間の取引
  const checkRow = (row, pair) => {
    if (row.eventSettlementPlanId) fail("failed-precondition", "全員分のまとめて精算で使用中の支払いが含まれています。");
    const amount = Number(row.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) fail("failed-precondition", "金額を確認できない支払いがあります。");
    const [a, b] = pair;
    const forward = row.paidById === a && row.paidToId === b;
    const backward = row.paidById === b && row.paidToId === a;
    if (!forward && !backward) fail("failed-precondition", "当事者以外の支払いが含まれています。");
    return amount;
  };

  // =============================================================
  // 申請・受け取りの確定（画面の「支払った」「受け取った」）
  // =============================================================
  async function submit(uid, input) {
    const batchId = assertId(input.batchId, "申請ID");
    const friendUid = assertId(input.friendUid, "相手");
    if (friendUid === uid) fail("invalid-argument", "相手が正しくありません。");
    if (input.direction !== "pay" && input.direction !== "remind") fail("invalid-argument", "向きが指定されていません。");
    const direction = input.direction;
    const ids = uniqueIds(input.transactionIds, "支払いID");
    if (!input.expected || typeof input.expected !== "object") fail("invalid-argument", "画面の内訳がありません。");
    const want = {};
    for (const key of BREAKDOWN_KEYS) {
      const n = asCount(input.expected[key]);
      if (n === null) fail("invalid-argument", "画面の内訳が正しくありません。");
      want[key] = n;
    }
    const reason = noteOf(input.reason);
    // 払う人・受け取る人は向きと本人から決める（画面が渡すUIDは使わない）
    const payerUid = direction === "pay" ? uid : friendUid;
    const receiverUid = direction === "pay" ? friendUid : uid;

    return db.runTransaction(async (transaction) => {
      // ---- 読む ----
      const ledgerSnap = await transaction.get(ledgerRef(batchId));
      if (ledgerSnap.exists) {
        const saved = ledgerSnap.data();
        const same = saved.kind === "submit" && saved.actorUid === uid && saved.friendUid === friendUid
          && saved.direction === direction && sameSet(saved.transactionIds || [], ids)
          && BREAKDOWN_KEYS.every((key) => saved.breakdown && saved.breakdown[key] === want[key]);
        if (!same || saved.decision) fail("failed-precondition", "同じ申請IDが別の内容で使われています。画面を開き直してください。");
        // 同じ要求の再送：すでに適用済みなので、同じ結果を返すだけ（取引もお知らせも作り直さない）
        return { ...saved.result, replay: true };
      }
      const rows = await readRows(transaction, ids);
      const actorName = await nameOf(transaction, uid, "メンバー");
      const friendName = await nameOf(transaction, friendUid, "相手");

      // ---- 確かめる ----
      const main = [];
      const counter = [];
      for (const row of rows) {
        const amount = checkRow(row, [payerUid, receiverUid]);
        if ((row.status || "unpaid") !== "unpaid" || row.settlementBatch) fail("failed-precondition", STALE);
        (row.paidById === payerUid ? main : counter).push({ ...row, amount });
      }
      const got = { gross: sumOf(main), offset: sumOf(counter), net: sumOf(main) - sumOf(counter), count: main.length, counterCount: counter.length };
      if (got.net < 0 || BREAKDOWN_KEYS.some((key) => got[key] !== want[key])) fail("failed-precondition", MISMATCH);

      // 自分が払う側で、自分が払う分があるときだけ相手の承認待ちになる。
      // 受け取る側（現金を受け取った本人の確認）と、相手が自分に払う分だけのときはその場で完了。
      const pending = direction === "pay" && main.length > 0;
      const mainIds = main.map((r) => r.id);
      const counterIds = counter.map((r) => r.id);
      const batch = { id: batchId, ...got, payerUid, receiverUid, mainTransactionIds: mainIds, counterTransactionIds: counterIds };

      // ---- 書く（全部まとめて）----
      for (const row of main) {
        transaction.update(txRef(row.id), {
          status: pending ? PENDING : "completed", approvalReviewRequired: false,
          approvalRequestId: pending ? batchId : null, settlementBatch: { ...batch, role: "main" },
        });
      }
      for (const row of counter) {
        transaction.update(txRef(row.id), {
          status: "completed", approvalReviewRequired: false, approvalRequestId: null, settlementBatch: { ...batch, role: "offset" },
        });
      }
      const noticeRef = db.collection("notifications").doc(`settlement-batch-${batchId}`);
      if (pending) {
        transaction.set(noticeRef, {
          toUserId: friendUid, fromUserId: uid, fromUserName: actorName, type: "approval_request",
          batch: true, transactionIds: mainIds, count: mainIds.length, counterTransactionIds: counterIds,
          itemName: `${friendName}との精算`,
          // 金額は「実際にやり取りする額（相殺後）」。内訳も一緒に送り、お知らせ・承認待ち一覧・詳細で同じ数字を出す。
          amount: got.net, batchId, approvalRequestId: batchId,
          batchGross: got.gross, batchOffset: got.offset, batchCounterCount: got.counterCount,
          message: "まとめて精算の承認リクエストが届きました。", userMessage: reason, isRead: false, createdAt: now(),
        });
      } else {
        transaction.set(noticeRef, {
          toUserId: friendUid, fromUserId: uid, fromUserName: actorName, type: "payment_completed",
          batch: true, transactionIds: ids, batchId, amount: got.net,
          message: got.offset
            ? `${actorName}さんが${rows.length}件をまとめて精算しました（対象 ${yenText(got.gross)}・あなたの受け取り ${yenText(got.offset)}と相殺 → 実質 ${yenText(got.net)}）。`
            : `${actorName}さんが${rows.length}件をまとめて精算しました。`,
          userMessage: reason, isRead: false, createdAt: now(),
        });
      }
      const result = {
        batchId, status: pending ? PENDING : "completed", direction, payerUid, receiverUid, ...got,
        mainTransactionIds: mainIds, counterTransactionIds: counterIds,
      };
      transaction.set(ledgerRef(batchId), {
        kind: "submit", actorUid: uid, friendUid, direction, transactionIds: ids, breakdown: got,
        status: result.status, result, createdAt: now(),
      });
      return { ...result, replay: false };
    });
  }

  // =============================================================
  // 承認・拒否（受け取る側）
  // =============================================================

  // 同じ内訳（settlementBatch.id）を持つ取引をひとまとまりとして確かめる。
  // 「整った形」の基準：全件読めて、主側・相殺側の件数と合計が内訳と一致し、
  // 主側は承認待ち（または全件完了）・相殺側は完了、内訳の値が全件で同じ。
  // それ以外は壊れた旧バッチとして、変更せずに止める（黙って読み替えない）。
  const buildBatchGroup = ({ batchId, members, uid, targetIds }) => {
    const seed = members.find((m) => m.settlementBatch && m.settlementBatch.id === batchId);
    if (!seed) fail("failed-precondition", BROKEN);
    const batch = seed.settlementBatch;
    if (batch.receiverUid !== uid || !batch.payerUid || batch.payerUid === uid) fail("failed-precondition", BROKEN);
    for (const key of BREAKDOWN_KEYS) if (asCount(batch[key]) === null) fail("failed-precondition", BROKEN);
    const main = [];
    const counter = [];
    for (const row of members) {
      const b = row.settlementBatch;
      if (!b || SHARED_KEYS.some((key) => b[key] !== batch[key])) fail("failed-precondition", BROKEN);
      const amount = checkRow(row, [batch.payerUid, uid]);
      const isMain = (b.role || "main") === "main";
      if (row.paidById !== (isMain ? batch.payerUid : uid)) fail("failed-precondition", BROKEN);
      (isMain ? main : counter).push({ ...row, amount });
    }
    if (main.length !== batch.count || counter.length !== batch.counterCount
      || sumOf(main) !== batch.gross || sumOf(counter) !== batch.offset
      || batch.gross - batch.offset !== batch.net) fail("failed-precondition", BROKEN);
    if (Array.isArray(batch.mainTransactionIds) && !sameSet(batch.mainTransactionIds, main.map((r) => r.id))) fail("failed-precondition", BROKEN);
    if (Array.isArray(batch.counterTransactionIds) && !sameSet(batch.counterTransactionIds, counter.map((r) => r.id))) fail("failed-precondition", BROKEN);
    if (!counter.every((r) => (r.status || "unpaid") === "completed")) fail("failed-precondition", BROKEN);
    // 画面が渡したのは主側の取引だけのはず（相殺側を直接承認・拒否する入口はない）
    if (targetIds.some((id) => !main.some((r) => r.id === id))) fail("failed-precondition", BROKEN);
    const mainStatuses = new Set(main.map((r) => r.status || "unpaid"));
    const state = mainStatuses.size === 1 && mainStatuses.has(PENDING) ? "pending"
      : mainStatuses.size === 1 && mainStatuses.has("completed") ? "approved"
        : "broken";
    if (state === "broken") fail("failed-precondition", BROKEN);
    return {
      key: batchId, batch: true, state, main, counter, otherUid: batch.payerUid, amount: batch.net,
      itemName: `まとめて精算（${main.length}件）`, eventName: "",
    };
  };

  const buildSingleGroup = (row, uid) => {
    if (row.paidToId !== uid || !row.paidById || row.paidById === uid) fail("failed-precondition", "この支払いの承認は、受け取る側だけができます。");
    const amount = checkRow(row, [row.paidById, uid]);
    const status = row.status || "unpaid";
    const state = status === PENDING ? "pending"
      : status === "completed" ? "approved"
        : (status === "unpaid" && row.approvalReviewRequired === true ? "rejected" : "stale");
    if (state === "stale") fail("failed-precondition", STALE);
    return {
      key: row.approvalRequestId || `legacy-${row.id}`,
      batch: false, state, main: [{ ...row, amount }], counter: [], otherUid: row.paidById, amount,
      itemName: row.itemName || "", eventName: row.eventName || "",
    };
  };

  async function decide(uid, input) {
    if (input.decision !== "approved" && input.decision !== "rejected") fail("invalid-argument", "判断が指定されていません。");
    const decision = input.decision;
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) fail("invalid-argument", "対象の支払いがありません。");
    const targets = input.items.map((it) => ({
      id: assertId(it && it.id, "支払いID"),
      requestId: it && it.requestId ? assertId(it.requestId, "申請ID") : null,
    }));
    if (new Set(targets.map((t) => t.id)).size !== targets.length) fail("invalid-argument", "同じ支払いが重複しています。");
    let expectedAmount = null;
    if (input.expectedAmount !== undefined && input.expectedAmount !== null) {
      expectedAmount = asCount(input.expectedAmount);
      if (expectedAmount === null) fail("invalid-argument", "画面の金額が正しくありません。");
    }
    const notificationId = input.notificationId ? assertId(input.notificationId, "お知らせID") : null;
    const reason = noteOf(input.reason);
    const otherDecision = decision === "approved" ? "この申請はすでに拒否されています。" : "この申請はすでに承認されています。";
    // 台帳の鍵：まとめ精算は内訳ID、単発は申請ID、申請IDの無い古い取引は取引ID
    const ledgerKeyOf = (target) => target.requestId || `legacy-${target.id}`;

    return db.runTransaction(async (transaction) => {
      // ---- 読む（書く前にすべて読む）----
      const rows = await readRows(transaction, targets.map((t) => t.id));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ledgerKeys = [...new Set(targets.map(ledgerKeyOf))];
      const ledgerSnaps = await Promise.all(ledgerKeys.map((key) => transaction.get(ledgerRef(key))));
      const ledgers = new Map(ledgerKeys.map((key, i) => [key, ledgerSnaps[i].exists ? ledgerSnaps[i].data() : null]));

      // 画面が見た申請（内訳ID または 申請ID）と今の取引を突き合わせる。
      // 違っていれば、台帳に同じ判断が記録された再送だけを「適用済み」とし、別の判断なら止め、それ以外は古い画面として止める。
      const replayed = new Map(); // 台帳の鍵 → 台帳
      const live = [];
      for (const target of targets) {
        const row = byId.get(target.id);
        const rowKey = row.settlementBatch && row.settlementBatch.id ? row.settlementBatch.id : (row.approvalRequestId || null);
        if (rowKey === (target.requestId || null)) { live.push(target); continue; }
        const saved = ledgers.get(ledgerKeyOf(target));
        if (!(saved && saved.decision && (saved.transactionIds || []).includes(target.id))) fail("failed-precondition", STALE);
        if (saved.decision !== decision) fail("failed-precondition", otherDecision);
        replayed.set(ledgerKeyOf(target), saved);
      }

      // まとめ精算の仲間（主側・相殺側）をそろえる。新しい形は内訳のID一覧から、旧形式は当事者の取引から探す。
      const batchIds = [];
      for (const target of live) {
        const b = byId.get(target.id).settlementBatch;
        if (b && b.id && !batchIds.includes(b.id)) batchIds.push(b.id);
      }
      const membersByBatch = new Map();
      let pairRows = null;
      for (const batchId of batchIds) {
        const b = rows.find((r) => r.settlementBatch && r.settlementBatch.id === batchId).settlementBatch;
        let members;
        if (Array.isArray(b.mainTransactionIds) && Array.isArray(b.counterTransactionIds)) {
          const ids = [...new Set([...b.mainTransactionIds, ...b.counterTransactionIds])];
          const extra = await readRows(transaction, ids.filter((id) => !byId.has(id)));
          extra.forEach((r) => byId.set(r.id, r));
          members = ids.map((id) => byId.get(id));
        } else {
          if (!pairRows) {
            const snaps = await Promise.all(["paidToId", "paidById"].map((field) => transaction.get(db.collection("transactions").where(field, "==", uid))));
            pairRows = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
          members = pairRows.filter((r) => r.settlementBatch && r.settlementBatch.id === batchId);
        }
        membersByBatch.set(batchId, members);
      }
      const groups = [];
      for (const batchId of batchIds) {
        groups.push(buildBatchGroup({
          batchId, members: membersByBatch.get(batchId), uid,
          targetIds: live.filter((t) => t.requestId === batchId).map((t) => t.id),
        }));
      }
      for (const target of live) {
        const row = byId.get(target.id);
        if (!(row.settlementBatch && row.settlementBatch.id)) groups.push(buildSingleGroup(row, uid));
      }

      // 台帳：同じ判断の再送なら同じ結果を返し、別の判断がすでに適用済みなら止める
      for (const g of groups) {
        const saved = ledgers.get(g.key) || null;
        g.ledger = saved;
        // 台帳の判断は、取引の状態がその判断どおりのときだけ生きている（旧画面で再申請された単発は別の回とみなす）
        const liveDecision = saved && saved.decision && g.state !== "pending" ? saved.decision : null;
        if (liveDecision && liveDecision !== decision) fail("failed-precondition", otherDecision);
        if (g.state === "pending") g.action = "apply";
        else if (g.state === decision || liveDecision === decision) g.action = "replay";
        else fail("failed-precondition", otherDecision);
      }
      // 画面に出していた金額（まとめ精算は実質額、単発は額面の合計）と違えば止める。再送分は台帳の金額で数える
      const shownAmount = groups.reduce((s, g) => s + g.amount, 0) + [...replayed.values()].reduce((s, saved) => s + (Number(saved.amount) || 0), 0);
      if (expectedAmount !== null && shownAmount !== expectedAmount) fail("failed-precondition", STALE);

      const applying = groups.filter((g) => g.action === "apply");
      const resultOf = (replay) => {
        const items = [
          ...groups.map((g) => ({ key: g.key, batch: g.batch, otherUid: g.otherUid, amount: g.amount, transactionIds: g.main.map((r) => r.id), counterTransactionIds: decision === "rejected" ? g.counter.map((r) => r.id) : [] })),
          ...[...replayed.entries()].map(([key, saved]) => ({ key, batch: saved.kind !== "single", otherUid: saved.otherUid || null, amount: saved.amount || 0, transactionIds: saved.transactionIds || [], counterTransactionIds: decision === "rejected" ? (saved.counterTransactionIds || []) : [] })),
        ];
        return {
          decision, status: decision === "approved" ? "completed" : "unpaid", replay,
          transactionIds: items.flatMap((g) => g.transactionIds),
          counterTransactionIds: items.flatMap((g) => g.counterTransactionIds),
          groups: items,
        };
      };
      if (applying.length === 0) return resultOf(true);

      const actorName = await nameOf(transaction, uid, "メンバー");
      const otherNames = new Map();
      for (const g of applying) if (!otherNames.has(g.otherUid)) otherNames.set(g.otherUid, await nameOf(transaction, g.otherUid, "相手"));
      // 既読にするお知らせ：画面が押したものと、同じ取引を指す未読の承認リクエスト
      const touchedIds = new Set(applying.flatMap((g) => g.main.map((r) => r.id)));
      const noticeRefs = [];
      if (notificationId) {
        const snap = await transaction.get(db.collection("notifications").doc(notificationId));
        if (snap.exists && snap.data().toUserId === uid && snap.data().type === "approval_request") noticeRefs.push(snap.ref);
      }
      const unread = await transaction.get(db.collection("notifications").where("toUserId", "==", uid).where("isRead", "==", false));
      for (const d of unread.docs) {
        const n = d.data() || {};
        if (n.type !== "approval_request") continue;
        const hit = touchedIds.has(n.transactionId) || (Array.isArray(n.transactionIds) && n.transactionIds.some((id) => touchedIds.has(id)));
        if (hit && !noticeRefs.some((r) => r.path === d.ref.path)) noticeRefs.push(d.ref);
      }

      // ---- 書く（全部まとめて）----
      for (const g of applying) {
        if (decision === "approved") {
          for (const r of g.main) transaction.update(txRef(r.id), { status: "completed", approvalReviewRequired: false });
        } else {
          // 差し戻し：主側も、相殺に使った逆方向の取引も未払いへ戻す。送金が済んでいるかは当事者にしか分からないので確認の印を立てる。
          for (const r of [...g.main, ...g.counter]) {
            transaction.update(txRef(r.id), { status: "unpaid", settlementBatch: null, approvalReviewRequired: true, approvalRequestId: null });
          }
        }
        const mainIds = g.main.map((r) => r.id);
        const counterIds = g.counter.map((r) => r.id);
        const message = decision === "approved"
          ? (g.batch ? `${mainIds.length}件の精算が承認され、完了しました。` : "支払いが承認され、精算が完了しました。")
          : (counterIds.length
            ? "まとめ精算の承認リクエストが拒否されました。双方向の精算がすべて未払いに戻っています。もう一度お手続きできます。"
            : (mainIds.length > 1
              ? "まとめ精算の承認リクエストが拒否されました。もう一度お手続きできます。"
              : "承認リクエストが拒否されました。もう一度お支払い手続きをしてください。"));
        transaction.set(db.collection("notifications").doc(`settlement-decision-${g.key}-${decision}`), {
          toUserId: g.otherUid, fromUserId: uid, fromUserName: actorName,
          type: decision === "approved" ? "payment_completed" : "approval_rejected",
          transactionId: mainIds[0], transactionIds: mainIds, counterTransactionIds: counterIds,
          batch: g.batch, batchId: g.batch ? g.key : null, amount: g.amount,
          itemName: g.itemName, eventName: g.eventName, message, userMessage: reason, isRead: false, createdAt: now(),
        });
        // 承認履歴（お知らせとは別の、消えない記録）。自分視点と相手視点の2行。書いた人（byUid）を必ず残す。
        const history = { kind: "payment", outcome: decision, itemName: g.itemName, amount: g.amount, byUid: uid, createdAt: now() };
        transaction.set(db.collection("approvalHistory").doc(), { ...history, userId: uid, role: "byMe", otherName: otherNames.get(g.otherUid) });
        transaction.set(db.collection("approvalHistory").doc(), { ...history, userId: g.otherUid, role: "toMe", otherName: actorName });
        transaction.set(ledgerRef(g.key), {
          kind: g.ledger && g.ledger.kind ? g.ledger.kind : (g.batch ? "legacy-batch" : "single"),
          decision, decidedBy: uid, decidedAt: now(), otherUid: g.otherUid, amount: g.amount,
          transactionIds: mainIds, counterTransactionIds: counterIds,
        }, { merge: true });
      }
      for (const ref of noticeRefs) transaction.update(ref, { isRead: true });
      return resultOf(false);
    });
  }

  async function handle(uid, input = {}) {
    if (!uid) fail("unauthenticated", "ログインが必要です。");
    if (input.action === "submit") return submit(uid, input);
    if (input.action === "decide") return decide(uid, input);
    fail("invalid-argument", "操作が指定されていません。");
  }

  return { submit, decide, handle };
}

module.exports = { createSettlementBatchService };
