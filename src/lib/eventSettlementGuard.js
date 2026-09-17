// イベント全体のまとめて精算に含まれた元取引は、通常の支払い導線で扱わない。
// 画面ごとに条件がずれないよう、表示・遷移・操作直前の判定をここへ集約する。

export const eventSettlementPlanIdOf = (transaction) => {
  const value = transaction && transaction.eventSettlementPlanId;
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

export const isEventSettlementReserved = (transaction) => !!eventSettlementPlanIdOf(transaction);

export const eventSettlementRouteOf = (transaction, extraQuery = {}) => {
  const eventId = transaction && transaction.eventId;
  const planId = eventSettlementPlanIdOf(transaction);
  if (!eventId) return null;
  return {
    path: `/event/${encodeURIComponent(eventId)}`,
    query: { ...(planId ? { settlement: planId } : {}), ...extraQuery },
  };
};

export const eventSettlementStatusLabel = (transaction) => {
  if (!isEventSettlementReserved(transaction)) return '';
  return (transaction.status || 'unpaid') === 'completed'
    ? 'まとめて精算で確定済み'
    : 'イベントでまとめて精算中';
};

export const assertStandardPaymentAllowed = (transaction) => {
  if (!isEventSettlementReserved(transaction)) return transaction;
  const error = new Error(
    (transaction.status || 'unpaid') === 'completed'
      ? 'この支払いはイベントのまとめて精算で確定済みです。イベントから記録を確認してください。'
      : 'この支払いはイベントでまとめて精算中です。イベントの「まとめて精算」から操作してください。',
  );
  error.code = 'event-settlement-reserved';
  error.route = eventSettlementRouteOf(transaction);
  throw error;
};
