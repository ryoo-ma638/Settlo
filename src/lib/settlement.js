// まとめ精算（全イベント横断・相手ごとに相殺）の共通処理
//
// 双方向のまとめ精算は「自分が払う分＝相手の承認待ち／相手が自分に払う分＝その場で完了」に
// 分かれている（精算した人の承認待ち一覧に自分の分が出ないようにするため）。
// 申請・承認・拒否の確定は Cloud Functions（settlementBatch、呼び出し口は src/lib/settlementApi.js）が
// 対象の取引全件・内訳・お知らせ・承認履歴を1回で書く。拒否のときは、その場で完了にした逆方向の
// 取引もサーバーが取引から集めて未払いに戻すので、画面側はお知らせの記録や既読・未読に頼らない。
import { db } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// ========== まとめ精算の「相殺の内訳」 ==========
// 双方向のまとめ精算は、実際にやり取りする金額（ネット額）と
// 精算の対象になった取引の合計額が食い違う（例：対象¥500・相殺¥400・実質¥100）。
// お知らせだけがネット額を出していたため「¥100と¥500のどちらが本当か」が分からなかった。
// そこで精算のときに内訳を対象の取引すべてへ同じ形で書き込み（settlementBatch）、
// お知らせ・承認待ち一覧・決済の詳細が同じ数字と同じ言い回しを出せるようにする。
//
// settlementBatch = {
//   id, gross(対象の合計), offset(相殺した額), net(実際にやり取りした額),
//   count(対象の件数), counterCount(相殺した件数),
//   payerUid(お金を渡す人), receiverUid(受け取る人),
//   role: 'main'(対象そのもの) | 'offset'(相殺に使った逆方向の取引)
// }

// ※ 内訳の文言（batchBreakdownText / hasOffset）は表示用なので src/lib/format.js にある。

export function makeBatchId() {
  return `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ※ 内訳の書き込みはサーバー側（functions/settlementBatchCore.js）が、取引の状態と同じ1回の書き込みで行う。
//    画面からは内訳を付けたり書き換えたりできない（firestore.rules）。

// 状態ごとの更新内容は transactionPatch.js に集約している。
// 従来どおり '@/lib/settlement' からも読めるように、そのまま渡す。
export { UNPAID_PATCH, REJECTED_PATCH, COMPLETED_PATCH, AWAITING_PATCH } from './transactionPatch';

// まとめ精算の対象取引を batchId から集める。
// ルール上そのままでは横断検索できないので、自分が当事者の取引を引いてから絞り込む。
export async function fetchBatchTransactions(myUid, batchId, side) {
  if (!myUid || !batchId) return [];
  const field = side === 'receive' ? 'paidToId' : 'paidById';
  try {
    const snap = await getDocs(query(collection(db, 'transactions'), where(field, '==', myUid)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => t.settlementBatch && t.settlementBatch.id === batchId && (t.settlementBatch.role || 'main') === 'main');
  } catch (e) { return []; }
}

// 差し戻しでチャットに流す文言（逆方向の取引用）
export const COUNTER_REVERT_TEXT = 'まとめ精算が差し戻されたため、この支払いも未払いに戻りました';
