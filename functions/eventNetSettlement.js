const crypto = require("node:crypto");

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

const asYen = (value) => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : 0;
};

const participantIds = (eventData) => [...new Set((eventData.participants || [])
  .map((person) => typeof person === "string" ? person : person && (person.id || person.uid))
  .filter(Boolean))];

const better = (candidate, current) => {
  if (!current) return true;
  if (candidate.length !== current.length) return candidate.length < current.length;
  const odd = (rows) => rows.filter((row) => row.amount % 100 !== 0).length;
  return odd(candidate) < odd(current);
};

const transferFor = (leftId, left, rightId, amount) => left < 0
  ? { fromId: leftId, toId: rightId, amount }
  : { fromId: rightId, toId: leftId, amount };

function exactTransfers(entries) {
  let best = null;
  const seen = new Map();
  const visit = (balances, rows) => {
    const first = balances.findIndex(([, value]) => value !== 0);
    if (first < 0) {
      if (better(rows, best)) best = rows.map((row) => ({ ...row }));
      return;
    }
    if (best && rows.length >= best.length) return;
    const key = balances.map(([, value]) => value).join(",");
    const oddCount = rows.filter((row) => row.amount % 100 !== 0).length;
    const previous = seen.get(key);
    if (previous && (previous.length < rows.length
      || (previous.length === rows.length && previous.odd <= oddCount))) return;
    seen.set(key, { length: rows.length, odd: oddCount });

    const [leftId, left] = balances[first];
    const duplicateAmounts = new Set();
    const choices = [];
    for (let index = first + 1; index < balances.length; index += 1) {
      const right = balances[index][1];
      if (!right || Math.sign(right) === Math.sign(left) || duplicateAmounts.has(right)) continue;
      duplicateAmounts.add(right);
      const amount = Math.min(Math.abs(left), Math.abs(right));
      choices.push({ index, amount, round: amount % 100 === 0 });
    }
    choices.sort((a, b) => Number(b.round) - Number(a.round) || b.amount - a.amount);
    for (const choice of choices) {
      const next = balances.map((row) => [...row]);
      const right = next[choice.index][1];
      next[first][1] += left < 0 ? choice.amount : -choice.amount;
      next[choice.index][1] += right < 0 ? choice.amount : -choice.amount;
      visit(next, [...rows, transferFor(leftId, left, next[choice.index][0], choice.amount)]);
    }
  };
  visit(entries.map((row) => [...row]), []);
  return best || [];
}

function runGreedy(entries, preferHundreds) {
  const debtors = entries.filter(([, value]) => value < 0)
    .map(([id, value]) => ({ id, amount: -value }));
  const creditors = entries.filter(([, value]) => value > 0)
    .map(([id, value]) => ({ id, amount: value }));
  const rows = [];
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.amount - a.amount);
    const debtor = debtors[0];
    creditors.sort((a, b) => {
      if (!preferHundreds) return b.amount - a.amount;
      const aAmount = Math.min(debtor.amount, a.amount);
      const bAmount = Math.min(debtor.amount, b.amount);
      return Number(bAmount % 100 === 0) - Number(aAmount % 100 === 0) || b.amount - a.amount;
    });
    const creditor = creditors[0];
    const amount = Math.min(debtor.amount, creditor.amount);
    rows.push({ fromId: debtor.id, toId: creditor.id, amount });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (!debtor.amount) debtors.shift();
    if (!creditor.amount) creditors.shift();
  }
  return rows;
}

function greedyTransfers(entries) {
  const fewerFirst = runGreedy(entries, false);
  const hundredsFirst = runGreedy(entries, true);
  return better(hundredsFirst, fewerFirst) ? hundredsFirst : fewerFirst;
}

function calculatePlan(transactions, participants) {
  const allowed = new Set(participants);
  const balances = new Map(participants.map((uid) => [uid, 0]));
  const sources = [];
  for (const snap of transactions) {
    const data = snap.data();
    if ((data.status || "unpaid") !== "unpaid" || data.syntheticSettlement) continue;
    if (data.eventSettlementPlanId) {
      fail("failed-precondition", "別のまとめて精算で使用中の取引があります。");
    }
    const amount = asYen(data.amount);
    const fromId = data.paidById;
    const toId = data.paidToId;
    if (!amount || !fromId || !toId || fromId === toId) continue;
    if (!allowed.has(fromId) || !allowed.has(toId)) {
      fail("failed-precondition", "イベント参加者ではない人を含む取引があります。");
    }
    balances.set(fromId, balances.get(fromId) - amount);
    balances.set(toId, balances.get(toId) + amount);
    sources.push({
      id: snap.id,
      paidById: fromId,
      paidToId: toId,
      amount,
      itemName: data.itemName || "",
      historyId: data.historyId || null,
    });
  }
  if (!sources.length) fail("failed-precondition", "精算する未払い取引がありません。");
  const entries = [...balances.entries()].filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  if (entries.reduce((sum, [, amount]) => sum + amount, 0) !== 0) {
    fail("failed-precondition", "精算額の合計が一致しません。");
  }
  const transfers = entries.length <= 13 ? exactTransfers(entries) : greedyTransfers(entries);
  if (!transfers.length) {
    fail("failed-precondition", "送金額が0円になる取引があります。元の明細を個別に確認してください。");
  }
  return { sources, transfers };
}

function calculateRefreshedPlan({ transactions, participants, planId, legs }) {
  const allowed = new Set(participants);
  const balances = new Map(participants.map((uid) => [uid, 0]));
  const sources = [];
  for (const snap of transactions) {
    const data = typeof snap.data === "function" ? snap.data() : snap;
    const id = snap.id || data.id;
    if ((data.status || "unpaid") !== "unpaid" || data.syntheticSettlement) continue;
    const reservedBy = data.eventSettlementPlanId || null;
    if (reservedBy && reservedBy !== planId) {
      fail("failed-precondition", "別のまとめて精算で使用中の取引があります。");
    }
    const amount = asYen(data.amount);
    const fromId = data.paidById;
    const toId = data.paidToId;
    if (!amount || !fromId || !toId || fromId === toId) continue;
    if (!allowed.has(fromId) || !allowed.has(toId)) {
      fail("failed-precondition", "イベント参加者ではない人を含む取引があります。");
    }
    balances.set(fromId, balances.get(fromId) - amount);
    balances.set(toId, balances.get(toId) + amount);
    sources.push({ id, paidById: fromId, paidToId: toId, amount, itemName: data.itemName || "", historyId: data.historyId || null });
  }
  const fixedLegs = legs.filter((row) => row.status === "completed" || row.status === "awaiting_approval");
  for (const leg of fixedLegs) {
    const amount = asYen(leg.amount);
    if (!amount || !allowed.has(leg.fromId) || !allowed.has(leg.toId) || leg.fromId === leg.toId) {
      fail("failed-precondition", "確定済みの支払い内容を確認できません。");
    }
    balances.set(leg.fromId, balances.get(leg.fromId) + amount);
    balances.set(leg.toId, balances.get(leg.toId) - amount);
  }
  const entries = [...balances.entries()].filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));
  if (entries.reduce((sum, [, amount]) => sum + amount, 0) !== 0) {
    fail("failed-precondition", "精算額の合計が一致しません。");
  }
  const transfers = entries.length <= 13 ? exactTransfers(entries) : greedyTransfers(entries);
  return { sources, fixedLegs, transfers };
}

const stableId = (...parts) => crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 40);

const assertText = (value, name) => {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    fail("invalid-argument", `${name}が正しくありません。`);
  }
  return value.trim();
};

const assertParticipant = (eventData, uid) => {
  const ids = participantIds(eventData);
  if (!ids.includes(uid)) fail("permission-denied", "このイベントの参加者だけが操作できます。");
  return ids;
};

function createEventNetSettlementService({ db, FieldValue }) {
  const now = () => FieldValue.serverTimestamp();

  async function start(uid, input) {
    const eventId = assertText(input.eventId, "イベントID");
    const requestId = assertText(input.requestId, "操作ID");
    const planId = `event-net-${stableId(eventId, requestId)}`;
    const eventRef = db.collection("events").doc(eventId);
    const planRef = db.collection("eventSettlementPlans").doc(planId);
    const txQuery = db.collection("transactions").where("eventId", "==", eventId);

    return db.runTransaction(async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists) fail("not-found", "イベントが見つかりません。");
      const participants = assertParticipant(eventSnap.data(), uid);
      const replaySnap = await transaction.get(planRef);
      if (replaySnap.exists) {
        const replay = replaySnap.data();
        if (replay.eventId !== eventId || replay.creationRequestId !== requestId) {
          fail("already-exists", "同じ操作IDが別の精算に使われています。");
        }
        return { planId, status: replay.status, replay: true };
      }

      const activePlanId = eventSnap.data().activeEventSettlementPlanId || null;
      if (activePlanId) {
        const activeSnap = await transaction.get(db.collection("eventSettlementPlans").doc(activePlanId));
        if (!activeSnap.exists || activeSnap.data().eventId !== eventId || activeSnap.data().status !== "open") {
          fail("failed-precondition", "進行中のまとめて精算の状態を確認できません。");
        }
        return { planId: activePlanId, status: "open", alreadyActive: true };
      }

      const sourceSnap = await transaction.get(txQuery);
      const calculation = calculatePlan(sourceSnap.docs, participants);
      const legIds = calculation.transfers.map((_, index) => `leg-${index + 1}`);
      transaction.create(planRef, {
        eventId,
        participantIds: participants,
        creationRequestId: requestId,
        createdBy: uid,
        status: "open",
        version: 1,
        sourceTransactions: calculation.sources,
        sourceTransactionIds: calculation.sources.map((row) => row.id),
        legIds,
        createdAt: now(),
        updatedAt: now(),
      });
      calculation.transfers.forEach((row, index) => {
        transaction.create(planRef.collection("legs").doc(legIds[index]), {
          ...row,
          eventId,
          sourceTransactionIds: calculation.sources.map((source) => source.id),
          status: "unpaid",
          paymentRequestId: null,
          lastDecision: null,
          lastDecisionRequestId: null,
          reviewRequired: false,
          createdAt: now(),
          updatedAt: now(),
        });
      });
      calculation.sources.forEach((source) => {
        transaction.update(db.collection("transactions").doc(source.id), {
          eventSettlementPlanId: planId,
        });
      });
      transaction.update(eventRef, { activeEventSettlementPlanId: planId });
      return { planId, status: "open", legCount: legIds.length, replay: false };
    });
  }

  async function refresh(uid, input) {
    const planId = assertText(input.planId, "精算ID");
    const requestId = assertText(input.requestId, "操作ID");
    const planRef = db.collection("eventSettlementPlans").doc(planId);
    return db.runTransaction(async (transaction) => {
      const planSnap = await transaction.get(planRef);
      if (!planSnap.exists) fail("not-found", "まとめて精算が見つかりません。");
      const plan = planSnap.data();
      if (plan.status !== "open") fail("failed-precondition", "このまとめて精算は完了しています。");
      if (!plan.participantIds.includes(uid)) fail("permission-denied", "このイベントの参加者だけが操作できます。");
      if (plan.lastRefreshRequestId === requestId) {
        return { planId, changed: !!plan.lastRefreshChanged, replay: true };
      }
      const eventRef = db.collection("events").doc(plan.eventId);
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists || eventSnap.data().activeEventSettlementPlanId !== planId) {
        fail("failed-precondition", "進行中のまとめて精算が変わっています。");
      }
      const legRefs = plan.legIds.map((id) => planRef.collection("legs").doc(id));
      const legSnaps = [];
      for (const ref of legRefs) legSnaps.push(await transaction.get(ref));
      if (legSnaps.some((snap) => !snap.exists)) fail("failed-precondition", "支払い内容を確認できません。");
      const txSnap = await transaction.get(db.collection("transactions").where("eventId", "==", plan.eventId));
      const legs = legSnaps.map((snap) => ({ id: snap.id, ...snap.data() }));
      const txById = new Map(txSnap.docs.map((snap) => [snap.id, snap]));
      for (const expected of plan.sourceTransactions || []) {
        const currentSnap = txById.get(expected.id);
        const current = currentSnap && currentSnap.data();
        if (!currentSnap || !current
          || (current.status || "unpaid") !== "unpaid"
          || current.eventSettlementPlanId !== planId
          || current.paidById !== expected.paidById
          || current.paidToId !== expected.paidToId
          || asYen(current.amount) !== expected.amount) {
          fail("failed-precondition", "元の取引が変わっています。追加分を反映できません。");
        }
      }
      const calculated = calculateRefreshedPlan({
        transactions: txSnap.docs,
        participants: plan.participantIds,
        planId,
        legs,
      });
      const oldSourceIds = new Set(plan.sourceTransactionIds || []);
      const newSources = calculated.sources.filter((row) => !oldSourceIds.has(row.id));
      if (!newSources.length) {
        transaction.update(planRef, { lastRefreshRequestId: requestId, lastRefreshChanged: false, updatedAt: now() });
        return { planId, changed: false, replay: false };
      }
      if (!calculated.transfers.length) {
        fail("failed-precondition", "追加分を含めると送金額が0円になります。追加分は個別に確認してください。");
      }
      const replaceable = legs.filter((row) => row.status === "unpaid");
      const nextVersion = Number(plan.version || 1) + 1;
      const newLegIds = calculated.transfers.map((_, index) => `leg-r${nextVersion}-${index + 1}-${stableId(planId, requestId, index).slice(0, 8)}`);
      replaceable.forEach((row) => transaction.delete(planRef.collection("legs").doc(row.id)));
      calculated.transfers.forEach((row, index) => {
        transaction.create(planRef.collection("legs").doc(newLegIds[index]), {
          ...row,
          eventId: plan.eventId,
          sourceTransactionIds: calculated.sources.map((source) => source.id),
          status: "unpaid",
          paymentRequestId: null,
          lastDecision: null,
          lastDecisionRequestId: null,
          reviewRequired: false,
          createdAt: now(),
          updatedAt: now(),
        });
      });
      newSources.forEach((source) => {
        transaction.update(db.collection("transactions").doc(source.id), { eventSettlementPlanId: planId });
      });
      transaction.update(planRef, {
        sourceTransactions: calculated.sources,
        sourceTransactionIds: calculated.sources.map((row) => row.id),
        legIds: [...calculated.fixedLegs.map((row) => row.id), ...newLegIds],
        version: nextVersion,
        lastRefreshRequestId: requestId,
        lastRefreshChanged: true,
        updatedAt: now(),
      });
      return { planId, changed: true, legCount: calculated.fixedLegs.length + newLegIds.length, replay: false };
    });
  }

  async function report(uid, input) {
    const planId = assertText(input.planId, "精算ID");
    const legId = assertText(input.legId, "支払いID");
    const requestId = assertText(input.requestId, "支払い報告ID");
    const planRef = db.collection("eventSettlementPlans").doc(planId);
    const legRef = planRef.collection("legs").doc(legId);
    const noticeRef = db.collection("notifications").doc(`event-net-report-${stableId(planId, legId, requestId)}`);
    return db.runTransaction(async (transaction) => {
      const planSnap = await transaction.get(planRef);
      const legSnap = await transaction.get(legRef);
      const actorSnap = await transaction.get(db.collection("users").doc(uid));
      if (!planSnap.exists || !legSnap.exists) fail("not-found", "まとめて精算の支払いが見つかりません。");
      const plan = planSnap.data();
      if (!plan.participantIds.includes(uid)) fail("permission-denied", "このイベントの参加者だけが操作できます。");
      const leg = legSnap.data();
      if (leg.fromId !== uid) fail("permission-denied", "支払う本人だけが報告できます。");
      if (leg.status === "awaiting_approval" && leg.paymentRequestId === requestId) {
        return { planId, legId, status: leg.status, replay: true };
      }
      if (plan.status !== "open" || leg.status !== "unpaid") {
        fail("failed-precondition", "支払い状況が変わっています。画面を開き直してください。");
      }
      transaction.update(legRef, {
        status: "awaiting_approval",
        paymentRequestId: requestId,
        reviewRequired: false,
        updatedAt: now(),
      });
      transaction.update(planRef, { version: FieldValue.increment(1), updatedAt: now() });
      transaction.set(noticeRef, {
        toUserId: leg.toId,
        fromUserId: uid,
        fromUserName: actorSnap.exists ? (actorSnap.data().name || "メンバー") : "メンバー",
        type: "event_settlement_approval_request",
        eventId: plan.eventId,
        planId,
        legId,
        paymentRequestId: requestId,
        amount: leg.amount,
        message: "まとめて精算の受取確認が届きました",
        isRead: false,
        createdAt: now(),
      });
      return { planId, legId, status: "awaiting_approval", replay: false };
    });
  }

  async function decide(uid, input) {
    const planId = assertText(input.planId, "精算ID");
    const legId = assertText(input.legId, "支払いID");
    const requestId = assertText(input.requestId, "支払い報告ID");
    const decision = input.decision;
    if (decision !== "approved" && decision !== "rejected") {
      fail("invalid-argument", "受取確認の結果が正しくありません。");
    }
    const planRef = db.collection("eventSettlementPlans").doc(planId);
    const legRef = planRef.collection("legs").doc(legId);
    return db.runTransaction(async (transaction) => {
      const planSnap = await transaction.get(planRef);
      const legSnap = await transaction.get(legRef);
      const actorSnap = await transaction.get(db.collection("users").doc(uid));
      if (!planSnap.exists || !legSnap.exists) fail("not-found", "まとめて精算の支払いが見つかりません。");
      const plan = planSnap.data();
      const leg = legSnap.data();
      if (!plan.participantIds.includes(uid)) fail("permission-denied", "このイベントの参加者だけが操作できます。");
      if (leg.toId !== uid) fail("permission-denied", "受け取る本人だけが確認できます。");
      if (leg.lastDecision === decision && leg.lastDecisionRequestId === requestId) {
        return { planId, legId, status: leg.status, planStatus: plan.status, replay: true };
      }
      if (plan.status !== "open" || leg.status !== "awaiting_approval" || leg.paymentRequestId !== requestId) {
        fail("failed-precondition", "支払い状況が変わっています。画面を開き直してください。");
      }

      const legRefs = plan.legIds.map((id) => planRef.collection("legs").doc(id));
      const legSnaps = [];
      for (const ref of legRefs) legSnaps.push(await transaction.get(ref));
      const sourceRefs = plan.sourceTransactionIds.map((id) => db.collection("transactions").doc(id));
      const sourceSnaps = [];
      if (decision === "approved") {
        for (const ref of sourceRefs) sourceSnaps.push(await transaction.get(ref));
      }

      if (decision === "rejected") {
        transaction.update(legRef, {
          status: "unpaid",
          paymentRequestId: null,
          lastDecision: decision,
          lastDecisionRequestId: requestId,
          reviewRequired: true,
          updatedAt: now(),
        });
        transaction.update(planRef, { version: FieldValue.increment(1), updatedAt: now() });
        transaction.set(db.collection("notifications").doc(`event-net-decision-${stableId(planId, legId, requestId, decision)}`), {
          toUserId: leg.fromId,
          fromUserId: uid,
          fromUserName: actorSnap.exists ? (actorSnap.data().name || "メンバー") : "メンバー",
          type: "event_settlement_rejected",
          eventId: plan.eventId,
          planId,
          legId,
          paymentRequestId: requestId,
          amount: leg.amount,
          message: "まとめて精算が未受取として差し戻されました",
          isRead: false,
          createdAt: now(),
        });
        return { planId, legId, status: "unpaid", planStatus: "open", replay: false };
      }

      const allCompleted = legSnaps.every((snap) => snap.id === legId
        ? true
        : snap.exists && snap.data().status === "completed");
      if (allCompleted) {
        const expected = new Map(plan.sourceTransactions.map((row) => [row.id, row]));
        sourceSnaps.forEach((snap) => {
          const source = snap.exists ? snap.data() : null;
          const original = expected.get(snap.id);
          if (!source || !original || source.eventId !== plan.eventId
            || source.eventSettlementPlanId !== planId
            || (source.status || "unpaid") !== "unpaid"
            || source.paidById !== original.paidById || source.paidToId !== original.paidToId
            || asYen(source.amount) !== original.amount) {
            fail("failed-precondition", "元の取引が変わっています。完了できません。");
          }
        });
      }

      transaction.update(legRef, {
        status: "completed",
        lastDecision: decision,
        lastDecisionRequestId: requestId,
        reviewRequired: false,
        completedAt: now(),
        updatedAt: now(),
      });
      if (allCompleted) {
        sourceRefs.forEach((ref) => transaction.update(ref, { status: "completed", completedAt: now() }));
        transaction.update(planRef, { status: "completed", version: FieldValue.increment(1), completedAt: now(), updatedAt: now() });
        transaction.update(db.collection("events").doc(plan.eventId), {
          activeEventSettlementPlanId: null,
          lastEventSettlementPlanId: planId,
        });
      } else {
        transaction.update(planRef, { version: FieldValue.increment(1), updatedAt: now() });
      }
      transaction.set(db.collection("notifications").doc(`event-net-decision-${stableId(planId, legId, requestId, decision)}`), {
        toUserId: leg.fromId,
        fromUserId: uid,
        fromUserName: actorSnap.exists ? (actorSnap.data().name || "メンバー") : "メンバー",
        type: "event_settlement_approved",
        eventId: plan.eventId,
        planId,
        legId,
        paymentRequestId: requestId,
        amount: leg.amount,
        message: "まとめて精算の受取が確認されました",
        isRead: false,
        createdAt: now(),
      });
      return { planId, legId, status: "completed", planStatus: allCompleted ? "completed" : "open", replay: false };
    });
  }

  async function handle(uid, input = {}) {
    if (!uid) fail("unauthenticated", "ログインが必要です。");
    if (input.action === "start") return start(uid, input);
    if (input.action === "refresh") return refresh(uid, input);
    if (input.action === "report") return report(uid, input);
    if (input.action === "decide") return decide(uid, input);
    fail("invalid-argument", "操作が指定されていません。");
  }

  return { start, refresh, report, decide, handle };
}

module.exports = { createEventNetSettlementService, calculatePlan, calculateRefreshedPlan };
