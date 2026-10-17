// 相手ごとのまとめ精算（支払い画面の「まとめて」）と、支払いの承認・拒否を、サーバー側で1回で確定する呼び出し口。
//
// なぜ画面から取引を直接書かないか
//   画面が取引を1件ずつ書くと、途中で電波が切れたときに「片側だけ完了」「内訳なし」「通知だけ」が残った。
//   Cloud Functions（settlementBatch）が対象の取引全件・お知らせ・承認履歴をまとめて書き、
//   途中で止まれば何も残さない。同じ要求を2回送っても、2回目は同じ結果を返すだけで書き込みを増やさない。
//   承認待ちのまとめ精算の取引は、ルール側でも画面からの直接の書き込みを閉じている。
import { functions } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

const call = (data) => httpsCallable(functions, 'settlementBatch')(data).then((res) => res.data);

// 申請・再送を見分けるためのID（取引や台帳の鍵になる）
export function makeRequestId(prefix = 'sr') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 申請（自分が払う側）または受け取りの確定（自分が受け取る側）。
// input = { batchId, friendUid, direction: 'pay' | 'remind', transactionIds, expected: { gross, offset, net, count, counterCount }, reason }
// 戻り値 = { status: 'awaiting_approval' | 'completed', mainTransactionIds, counterTransactionIds, gross, offset, net, count, counterCount, payerUid, receiverUid, replay }
export function submitSettlementBatch(input) {
  return call({ action: 'submit', ...input });
}

// 承認・拒否（受け取る側）。
// input = { decision: 'approved' | 'rejected', items: [{ id, requestId }], notificationId, expectedAmount, reason }
//   requestId は画面が見た申請（まとめ精算は内訳のID、単発は申請ID、無ければ null）。今の取引と違えばサーバーが止める。
// 戻り値 = { status, transactionIds（主側）, counterTransactionIds（拒否で戻した相殺側）, groups, replay }
export function decideSettlementApproval(input) {
  return call({ action: 'decide', ...input });
}

// サーバーが理由付きで止めたときはその文を、通信などそれ以外の失敗は共通の文を出す
export function settlementErrorMessage(error, fallback = '処理に失敗しました。電波状況を確認してもう一度お試しください。') {
  const code = String(error?.code || '');
  if (/failed-precondition|invalid-argument|not-found|permission-denied|already-exists/.test(code)) return error.message || fallback;
  if (/unauthenticated/.test(code)) return 'ログインし直してから、もう一度お試しください。';
  return fallback;
}
