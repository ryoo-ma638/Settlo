// お知らせの「中身」を、画面に出せる形に整える。
//
// 過去のお知らせは1行の要約しか出していなかったため、
// 何についての知らせだったのか（相手・イベント・品名・金額・日時）が分からなかった。
// ここは計算だけ（Firebase に触れない）ので、テストからそのまま呼べる。

import { formatDateTime, yen } from './format.js';

// 値として使えないもの（空・汎用語）は出さない。
const SKIP = ['', '精算', 'イベント', '不明', '不明なユーザー'];
const usable = (v) => typeof v === 'string' && v.trim() !== '' && !SKIP.includes(v.trim());

/**
 * お知らせ1件の内訳。
 * @returns {{ when: string, rows: {label: string, value: string}[], note: string }}
 */
export function notificationDetail(notification) {
  const n = notification || {};
  const rows = [];

  const other = n.fromUserName;
  if (usable(other)) rows.push({ label: '相手', value: `${other}さん` });

  // イベント名は、品名と同じときに二重に出さない（古いデータは品名が入っている）
  if (usable(n.eventName) && n.eventName !== n.itemName) {
    rows.push({ label: 'イベント', value: n.eventName });
  }
  if (usable(n.itemName)) rows.push({ label: '内容', value: n.itemName });

  const amount = Number(n.amount);
  if (Number.isFinite(amount) && amount > 0) rows.push({ label: '金額', value: yen(amount) });

  return {
    when: formatDateTime(n.createdAt) || '',
    rows,
    // 相手が書いた一言・変更の内訳。あれば添える
    note: [n.userMessage, n.changes].filter((t) => usable(t)).join('\n'),
  };
}

// 中身として出せるものが1つも無いお知らせか（そのときは「開く」だけ見せる）
export function hasDetail(notification) {
  const d = notificationDetail(notification);
  return d.rows.length > 0 || !!d.note;
}
