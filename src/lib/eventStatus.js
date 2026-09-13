// イベント詳細の「人ごとの精算状況」を出す共通の計算。
// ここは純粋な計算だけを置く（Firestore に触れない＝どの画面でも同じ結果になる）。
//
// ■ なぜ「人ごと」なのか
// 立て替え1件（history）には、負担する人の数だけ transactions がぶら下がる。
// 以前はその取引を「全部完了したか」で1つの状態に潰し、その1つの状態を
// 全員の負担額へそのまま当てていた。そのため次の食い違いが起きていた。
//   ・3人の立て替えで1人だけ返しても、返した人が精算サマリーに未払いで残る
//   ・その行から支払い画面へ進むと、支払い画面は取引を1件ずつ見て
//     完了済みを除くため「該当するお支払い情報が見つかりませんでした」になる
// 表示の条件（履歴単位）と、支払い対象を探す条件（取引単位）がずれていたのが原因。
// ここで負担者ごとに自分の取引の状態を持たせ、両方の条件を取引単位に揃える。

export const DONE = 'completed';
export const PENDING = 'awaiting_approval';
export const OPEN = 'unpaid';

// 取引のstatusを3値に正規化する（未設定は未払い扱い）
export function normalizeStatus(status) {
  const s = status || OPEN;
  if (s === DONE) return DONE;
  if (s === PENDING) return PENDING;
  return OPEN;
}

// 表示用の二値（承認待ちは「まだ精算されていない」側に入れる）
export function toBinary(status) {
  return normalizeStatus(status) === DONE ? DONE : OPEN;
}

// 複数の取引をまとめて1つの状態にする（全部完了なら完了／1つでも申請中なら申請中）
function mergeStatuses(list) {
  if (list.length === 0) return OPEN;
  if (list.every((s) => s === DONE)) return DONE;
  if (list.some((s) => s === PENDING)) return PENDING;
  return OPEN;
}

// Firestore へ書き戻す用に、負担額から計算由来の項目を落とす
// （ゴミ箱の控えなどに status が紛れ込まないようにする）
export function plainShares(shares = []) {
  return (shares || [])
    .filter(Boolean)
    .map((s) => ({ uid: s.uid || null, name: s.name || '', amount: Number(s.amount) || 0 }));
}

// 立て替え1件に、人ごとの精算状況を付ける。
//   raw    … Firestore の history ドキュメント（shares / transactionIds / payerUid …）
//   txById … { 取引ID: { status, paidById, paidToId } }（このイベントの取引）
//   loaded … 取引をまだ読めていない間は true にしない（保存済みの status を使う）
export function decorateHistory(raw, txById = {}, { loaded = true } = {}) {
  const txIds = Array.isArray(raw.transactionIds) ? raw.transactionIds : [];
  const payerUid = raw.payerUid || null;
  const cached = toBinary(raw.status);
  const rawShares = Array.isArray(raw.shares) ? raw.shares : [];

  // 取引がまだ届いていない間は、保存されている履歴の状態をそのまま使う
  // （読み込み中に「全員未払い」へ一瞬戻る、といったちらつきを避ける）
  if (!loaded) {
    const shares = rawShares.map((s) => (s ? { ...s, status: cached, settled: cached === DONE, isDebt: isDebtShare(s, payerUid), txId: null } : s));
    return withTotals(raw, shares, cached, false);
  }

  // 負担者 → 取引の対応づけ。保存時に対応表を持っていないので、
  // 取引に入っている債務者UID（paidById）で引き当てる。
  const byDebtor = new Map();
  for (const id of txIds) {
    const t = txById[id];
    if (!t) continue;
    const uid = t.paidById || null;
    if (!uid) continue;
    if (!byDebtor.has(uid)) byDebtor.set(uid, []);
    byDebtor.get(uid).push({ id, status: normalizeStatus(t.status) });
  }

  const shares = rawShares.map((s) => {
    if (!s) return s;
    // 立替者自身の取り分と0円は、誰かに払う必要が無い＝精算の対象外
    if (!isDebtShare(s, payerUid)) {
      return { ...s, status: DONE, settled: true, isDebt: false, txId: null };
    }
    const hits = byDebtor.get(s.uid) || [];
    if (hits.length === 0) {
      // 取引が見つからない（削除済み・古いデータ）ときは履歴の状態に従う
      return { ...s, status: cached, settled: cached === DONE, isDebt: true, txId: null };
    }
    const status = mergeStatuses(hits.map((h) => h.status));
    return { ...s, status, settled: status === DONE, isDebt: true, txId: hits[0].id };
  });

  // 履歴1件としての状態（立て替え履歴の一覧・イベント終了の判定に使う二値）
  let status;
  const debts = shares.filter((s) => s && s.isDebt);
  if (debts.length > 0) {
    status = debts.every((s) => s.settled) ? DONE : OPEN;
  } else if (rawShares.length > 0) {
    status = DONE; // 負担者がいない＝精算する相手がいない
  } else if (txIds.length === 0) {
    status = DONE; // 古いデータで取引も無い＝精算対象なし
  } else {
    // shares が無い古い履歴は取引の状態から直接まとめる
    status = txIds.every((id) => normalizeStatus(txById[id]?.status) === DONE) ? DONE : OPEN;
  }

  const anyPending = shares.some((s) => s && s.isDebt && s.status === PENDING)
    || (rawShares.length === 0 && txIds.some((id) => normalizeStatus(txById[id]?.status) === PENDING));

  return withTotals(raw, shares, status, anyPending);
}

// その負担額が「誰かに払う分」か（立替者本人の取り分と0円は対象外）
function isDebtShare(share, payerUid) {
  if (!share || !share.uid) return false;
  if (payerUid && share.uid === payerUid) return false;
  return (Number(share.amount) || 0) > 0;
}

function withTotals(raw, shares, status, pending) {
  const debts = shares.filter((s) => s && s.isDebt);
  const settledCount = debts.filter((s) => s.settled).length;
  const outstanding = debts
    .filter((s) => !s.settled)
    .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  return {
    ...raw,
    shares,
    status,
    pending,
    shareCount: debts.length,
    settledCount,
    // このイベントでまだ動いていない金額（＝精算サマリーに残る分）
    outstanding,
  };
}

// イベント全体の進捗（人ごとの精算が何件中何件済んだか）
export function settlementProgressOf(history = []) {
  let total = 0;
  let done = 0;
  for (const h of history) {
    total += h.shareCount || 0;
    done += h.settledCount || 0;
  }
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

// まだ精算されていない金額の合計
export function outstandingTotalOf(history = []) {
  return history.reduce((sum, h) => sum + (Number(h.outstanding) || 0), 0);
}
