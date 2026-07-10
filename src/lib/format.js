// 日付表示の共通フォーマッタ
// 表示ルール（本人確認済み）：今年なら「M/D」、年をまたぐなら「YYYY/M/D」。
// Firestore Timestamp / Date / 文字列(YYYY/MM/DD・YYYY-MM-DD) / 秒数 を受け付ける。

export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();               // Firestore Timestamp
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);                        // ミリ秒
  if (typeof value === 'string') {
    const d = new Date(value.replace(/-/g, '/').trim());
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// 日付だけ（例: 7/5 / 2026/7/5）。無効な値は空文字。
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return '';
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

// 日付＋時刻（例: 7/5 13:04）。
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mm}`;
}
