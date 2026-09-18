// お知らせの片付けの判断。Firestore に触れないのでテストからそのまま呼べる。
//
// 流れは2段階。
//   お知らせ一覧 →（確認を押す）→ 過去のお知らせ →（7日 or 手動で削除）→ 元に戻す →（7日 or 手動）→ 消滅
//
// 「過去へ移った日」は readAt。40か所ある既読処理すべてに日付を足すのは危ないので、
// 定期処理が初めて見たときに readAt を入れる（古いお知らせも自動で時計が合う）。

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const millis = (value) => (value && typeof value.toMillis === 'function' ? value.toMillis() : null);

/**
 * お知らせ1件を今どうするか。
 * @returns {"stamp-read"|"to-trash"|"delete"|"keep"}
 *   stamp-read … 過去へ移った日が無いので、いまの時刻を入れる
 *   to-trash   … 過去に入って7日たった。元に戻す へ移す
 *   delete     … 元に戻す に入って7日たった。消す
 *   keep       … まだ何もしない
 */
function noticeDecision(notification, nowMs) {
  const n = notification || {};

  // すでにゴミ箱にある分は、入った日から7日で消す
  if (n.inTrash === true) {
    const trashed = millis(n.trashedAt);
    // 日付が読めないものは消さない（いつ入ったか分からないため）
    if (trashed === null) return 'keep';
    return nowMs - trashed >= WEEK_MS ? 'delete' : 'keep';
  }

  // まだ読んでいないものは触らない（答えるまで残す種類もあるため）
  if (n.isRead !== true) return 'keep';

  const readAt = millis(n.readAt);
  if (readAt === null) return 'stamp-read';
  return nowMs - readAt >= WEEK_MS ? 'to-trash' : 'keep';
}

module.exports = { noticeDecision, WEEK_MS };
