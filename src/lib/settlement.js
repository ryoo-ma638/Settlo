// まとめ精算（全イベント横断・相手ごとに相殺）の共通処理
//
// 双方向のまとめ精算は「自分が払う分＝相手の承認待ち／相手が自分に払う分＝その場で完了」に
// 分かれている（精算した人の承認待ち一覧に自分の分が出ないようにするため）。
// 相手が承認リクエストを拒否したときは、承認待ちの分だけでなく
// その場で完了にした逆方向の取引も未払いに戻さないと、片側だけ完了のまま残ってしまう。
// そのため承認リクエストのお知らせに逆方向の取引ID（counterTransactionIds）を記録しておき、
// 拒否のときにここで戻す。
import { db } from '@/firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
import { postPaymentEventByTx } from './thread';

// 逆方向の取引（まとめ精算で即完了にした分）を未払いに戻す。
// 戻したのは当事者2人の完了済み取引だけ＝二重実行しても安全。戻した取引IDを返す。
export async function revertCounterTransactions({ myUid, otherUid, ids = [], skipIds = [], text } = {}) {
  if (!myUid || !otherUid) return [];
  const skip = new Set(skipIds);
  const targets = [...new Set((ids || []).filter((id) => id && !skip.has(id)))];
  const reverted = [];
  for (const tid of targets) {
    try {
      const snap = await getDoc(doc(db, 'transactions', tid));
      if (!snap.exists()) continue;
      const t = snap.data();
      // 当事者2人の取引か（第三者の取引には触らない）
      const isPair = (t.paidById === myUid && t.paidToId === otherUid)
        || (t.paidById === otherUid && t.paidToId === myUid);
      if (!isPair) continue;
      // まとめ精算で完了にした分だけを戻す（すでに未払い/承認待ちなら何もしない）
      if ((t.status || 'unpaid') !== 'completed') continue;
      await updateDoc(doc(db, 'transactions', tid), { status: 'unpaid' });
      reverted.push(tid);
      if (text) {
        try { await postPaymentEventByTx(tid, { text, kind: 'rejected', actorUid: myUid }); } catch (e) { /* チャットは失敗しても止めない */ }
      }
    } catch (e) { /* 1件失敗しても他を続ける */ }
  }
  return reverted;
}

// 取引IDから、自分あての「まとめ承認リクエスト（未読）」を探す。
// お知らせ以外の画面（決済の詳細・チャット）で拒否したときも逆方向の取引を戻せるようにするため。
// 逆方向の記録が無い古いお知らせは対象外＝従来どおりの動きになる。
export async function findBatchApprovalRequests(myUid, txIds = []) {
  if (!myUid || !txIds || txIds.length === 0) return [];
  const want = new Set(txIds.filter(Boolean));
  if (want.size === 0) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'notifications'),
      where('toUserId', '==', myUid),
      where('isRead', '==', false)
    ));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => n.type === 'approval_request'
        && Array.isArray(n.counterTransactionIds) && n.counterTransactionIds.length > 0
        && (n.transactionIds || []).some((t) => want.has(t)));
  } catch (e) { return []; }
}

// 差し戻しでチャットに流す文言（逆方向の取引用）
export const COUNTER_REVERT_TEXT = 'まとめ精算が差し戻されたため、この支払いも未払いに戻りました';
