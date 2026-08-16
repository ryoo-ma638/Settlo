// 表示の共通フォーマッタ（日付・まとめ精算の相殺の内訳）
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

// 金額（例: ¥1,234）。
export function yen(value) {
  return `¥${(Number(value) || 0).toLocaleString()}`;
}

// ---- まとめ精算（双方向）の相殺の内訳 ----
// 実際にやり取りする額（相殺後）と、精算の対象になった取引の合計額は食い違う。
// お知らせ・承認待ち一覧・決済の詳細で同じ言い回しを使い、数字の食い違いを説明する。
// batch = { gross, offset, net, count, counterCount, payerUid }（src/lib/settlement.js が記録）

// 相殺があるまとめ精算か（片方向だけなら内訳を出す必要はない）
export function hasOffset(batch) {
  return !!(batch && Number(batch.offset) > 0);
}

// 例）対象3件 ¥500 のうち、あなたの受け取り2件 ¥400 と相殺 → 実質 ¥100 の支払い
// 払う人か受け取る人かで言い回しが変わるので viewerUid で出し分ける。
export function batchBreakdownText(batch, viewerUid) {
  if (!hasOffset(batch)) return '';
  const isPayer = !!viewerUid && batch.payerUid === viewerUid;
  const side = isPayer ? 'あなたの受け取り' : 'あなたの未払い';
  const result = isPayer ? '支払い' : '受け取り';
  const n = (c) => (Number(c) > 0 ? `${c}件 ` : '');
  return `対象${n(batch.count)}${yen(batch.gross)} のうち、${side}${n(batch.counterCount)}${yen(batch.offset)} と相殺 → 実質 ${yen(batch.net)} の${result}`;
}
