export function mergePaymentThreadState(existing, info = {}) {
  const current = existing || {};
  const participants = [...new Set([...(current.participants || []), ...(info.participants || [])].filter(Boolean))];
  const transactionIds = [...new Set([...(current.transactionIds || []), ...(info.transactionIds || [])].filter(Boolean))];
  const unread = { ...(current.unread || {}) };
  participants.forEach((uid) => {
    if (!Object.prototype.hasOwnProperty.call(unread, uid)) unread[uid] = 0;
  });
  return { participants, transactionIds, unread };
}

export function allTransactionsCompleted(states = []) {
  return states.length > 0 && states.every((state) => state?.exists === true && state.status === 'completed');
}
