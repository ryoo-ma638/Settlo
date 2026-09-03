// 相手ごとの「差し引き」を出す共通の計算。
// ここは表示のための純粋な計算だけを置く（Firestore に触れない＝どの画面でも同じ数字になる）。
//
// ■ 承認待ち（awaiting_approval）をどう数えるか
// まとめ精算（双方向）を申請すると、対象の取引は次の2つに分かれる。
//   ・自分が払う分       → awaiting_approval（相手の承認待ち）
//   ・相手が自分に払う分 → completed（受け取り済みとして、その場で完了）
// completed は未決済の一覧から消えるので、承認待ちの分を額面のまま数えると
// 相殺前の金額だけが残り、「申請しただけで借りが増えた」ように見えてしまう。
//
// 申請中のまとめ精算には「実際にやり取りする額（settlementBatch.net）」が記録されているので、
// 同じ精算の取引は1件にまとめ、net で数える。相殺に使った逆方向の取引は completed で
// もともと一覧に入っていないため、これで二重計上にはならない。
// 承認されれば差し引きは 0 になり、拒否されれば逆方向の取引が未払いへ戻って同じ額に戻る。
// つまり申請の前後で金額が動かず、承認待ち一覧・決済の詳細（相殺の内訳）とも同じ数字になる。

export const PENDING_STATUS = 'awaiting_approval';

// 申請中のまとめ精算（相殺あり）の「対象そのもの（main）」の取引か
export function isPendingBatchMain(tx) {
  const b = tx && tx.settlementBatch;
  if (!b || !b.id) return false;
  if ((b.role || 'main') !== 'main') return false;
  if (!(Number(b.offset) > 0)) return false; // 相殺が無いなら額面＝実質なのでまとめる必要がない
  return (tx.status || 'unpaid') === PENDING_STATUS;
}

// 同じまとめ精算の取引を1行にまとめ、金額を実質額（net）に置き換える。
// 2件目以降は落とす（＝同じ精算を何度も数えない）。
export function collapsePendingBatches(list = []) {
  const out = [];
  const seen = new Set();
  for (const tx of list) {
    if (!isPendingBatchMain(tx)) { out.push(tx); continue; }
    const b = tx.settlementBatch;
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push({ ...tx, amount: Number(b.net) || 0, batchId: b.id, isBatchRow: true });
  }
  return out;
}

// 承認待ちの合計（まとめ精算は実質額で数える）
export function pendingTotal(list = []) {
  return collapsePendingBatches(list)
    .filter((t) => (t.status || 'unpaid') === PENDING_STATUS)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

// 相手ごとの差し引き。
// receivable＝自分が受け取る未決済／payable＝自分が支払う未決済。
// どちらの要素も { opponentUid, name, photo, amount, status, settlementBatch } を持つ想定。
// net > 0 … その人から受け取る／net < 0 … その人へ支払う。
export function balancesByPerson(receivable = [], payable = []) {
  const map = new Map();

  const bump = (item, side) => {
    const uid = item && item.opponentUid;
    if (!uid) return;
    let m = map.get(uid);
    if (!m) {
      m = { uid, name: item.name, photo: item.photo, receive: 0, pay: 0, pendingReceive: 0, pendingPay: 0 };
      map.set(uid, m);
    }
    const amount = Number(item.amount) || 0;
    m[side] += amount;
    if ((item.status || 'unpaid') === PENDING_STATUS) {
      m[side === 'receive' ? 'pendingReceive' : 'pendingPay'] += amount;
    }
    if ((!m.name || m.name === '不明なユーザー') && item.name) m.name = item.name;
    if (!m.photo && item.photo) m.photo = item.photo;
  };

  collapsePendingBatches(receivable).forEach((item) => bump(item, 'receive'));
  collapsePendingBatches(payable).forEach((item) => bump(item, 'pay'));

  return [...map.values()]
    .map((m) => ({ ...m, net: m.receive - m.pay, pending: m.pendingReceive + m.pendingPay }))
    .filter((m) => m.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}
