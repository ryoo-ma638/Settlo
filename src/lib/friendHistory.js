function registrationDate(value) {
  try {
    const date = typeof value?.toDate === 'function' ? value.toDate()
      : value instanceof Date ? value
      : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000)
      : typeof value === 'number' ? new Date(value)
      : typeof value === 'string' && value.trim() ? new Date(value) : null;
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}
export function dateMillis(value) { return registrationDate(value)?.getTime() ?? -Infinity; }
export function registrationLabel(value) {
  const d = registrationDate(value);
  if (!d) return '登録日不明';
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm} 登録`;
}
export function historyMonth(value) {
  const d = registrationDate(value);
  return d ? `${d.getFullYear()}年${d.getMonth() + 1}月` : '登録日不明';
}
export function transactionStatus(item) {
  // まとめて精算に予約された取引は、通常の未払い・精算済みとは別の状態として見せる
  if (item.eventSettlementLabel) return item.eventSettlementLabel;
  if (item.status === 'completed') return '精算済み';
  if (item.status === 'awaiting_approval') return item.type === 'receive' ? '受け取りの確認が必要' : '相手の確認待ち';
  return item.type === 'receive' ? 'お支払い待ち' : '未払い';
}
export function transactionCategory(item) {
  // 予約中を「未払い」に数えると、絞り込みの件数がずれる
  if (item.eventSettlementLabel) return 'event-settlement';
  if (item.status === 'completed') return item.type === 'receive' ? 'received' : 'paid';
  if (item.status === 'awaiting_approval') return item.type === 'receive' ? 'confirm-self' : 'confirm-other';
  return item.type === 'receive' ? 'waiting-payment' : 'unpaid';
}
export function statusTone(item) {
  if (item.eventSettlementLabel) return 'status-wait';
  if (item.status === 'completed') return 'status-done';
  return item.status === 'awaiting_approval' && item.type === 'receive' ? 'status-action' : 'status-wait';
}
