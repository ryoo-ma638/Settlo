export function mergePaymentThreadState(existing, info = {}) {
  const current = existing || {};
  // 既存会話に後から参加者を足すと過去メッセージまで公開されるため、参加者は作成時に固定する。
  const participants = current.participants?.length
    ? [...new Set(current.participants.filter(Boolean))]
    : [...new Set((info.participants || []).filter(Boolean))];
  const transactionIds = [...new Set([...(current.transactionIds || []), ...(info.transactionIds || [])].filter(Boolean))];
  const activeTransactionIds = Array.isArray(info.transactionIds)
    ? [...new Set(info.transactionIds.filter(Boolean))]
    : [...new Set((current.activeTransactionIds || current.transactionIds || []).filter(Boolean))];
  const unread = { ...(current.unread || {}) };
  participants.forEach((uid) => {
    if (!Object.prototype.hasOwnProperty.call(unread, uid)) unread[uid] = 0;
  });
  return { participants, transactionIds, activeTransactionIds, unread };
}

export function allTransactionsCompleted(states = []) {
  return states.length > 0 && states.every((state) => state?.exists === true && state.status === 'completed');
}
