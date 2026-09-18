// ゴミ箱（元に戻す）に入れたお知らせを、まだ手続きに使えるかどうかの判断。
//
// 消したあとに状況が変わっていることがある。そのまま押せてしまうと金額が狂うので、
// 押させずに理由を出す。計算だけ（Firestore に触れない）なのでテストからそのまま呼べる。

import { isEventSettlementReserved } from './eventSettlementGuard.js';

// 対象が要るお知らせの種類。これ以外は読むだけなので、手続きは無い。
const NEEDS_TARGET = [
  'payment_reminder', 'approval_request', 'payment_added',
  'settlement_restore_request', 'restore_check', 'payment_deleted',
];

/**
 * @param {object} args
 * @param {object} args.notification お知らせ
 * @param {object|null} args.transaction 対象の取引（無ければ null）
 * @param {object|null} args.event 対象のイベント（無ければ null）
 * @returns {{ can: boolean, reason: string }}
 */
export function noticeActionState({ notification, transaction = null, event = null } = {}) {
  const n = notification || {};

  if (!NEEDS_TARGET.includes(n.type)) {
    return { can: false, reason: 'これは読むだけのお知らせです。手続きはありません。' };
  }

  if (n.eventId && event === null) {
    return { can: false, reason: 'このイベントは無くなっています。戻す先がありません。' };
  }

  if (n.transactionId) {
    if (transaction === null) {
      return { can: false, reason: 'この支払いの記録が見つかりません。すでに消されています。' };
    }
    if (isEventSettlementReserved(transaction)) {
      return { can: false, reason: 'この分はイベントのまとめて精算に取り込まれました。ここからは戻せません。' };
    }
    if ((transaction.status || 'unpaid') === 'completed') {
      return {
        can: true,
        reason: 'この支払いはもう完了しています。未精算へ戻すには相手の承認が必要です。',
        needsApproval: true,
      };
    }
  }

  return { can: true, reason: '' };
}

/** 画面に出すボタンの文字 */
export function noticeActionLabel(state) {
  if (!state || !state.can) return '';
  return state.needsApproval ? '相手に確認を依頼する' : 'この件に戻って手続きする';
}
