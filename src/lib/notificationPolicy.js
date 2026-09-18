// お知らせを「操作が必要なもの」と「読むだけのもの」に分ける。
//
// 操作が必要なもの … 承認・参加・正しいかどうかの判定など、ボタンで答える必要がある。
//                    答えるまで消さない。答えると既読になって過去へ移る。
// 読むだけのもの   … 結果の連絡や催促。確認を押したら既読にして過去へ移す。
//
// ベルの数字は未読の件数。過去のお知らせは数えない。
// 既読にするだけで、お知らせそのものは消さない＝あとから必ず見返せる。

// ボタンで答える種類
// payment_added（支払いが追加された）は、答えることが無い連絡なので入れない。
// 入れていた頃は「確認」が出ず、イベントを見るまでベルから消せなかった。
const ACTION_TYPES = [
  'approval_request', 'event_invite', 'event_join_request', 'event_rejoin_request',
  'event_settlement_approval_request', 'settlement_restore_request', 'event_end_request',
  'thread_reply',
];

// 「正しい／正しくない」で答える種類
const JUDGE_TYPES = [
  'payment_deleted', 'payment_delete_rejected', 'restore_check', 'restore_reverted',
  'event_left_check', 'event_left_rejected', 'event_restored', 'event_restore_rejected',
  'settlement_restore_rejected', 'friend_removed', 'event_member_removed',
];

const KEEP_UNTIL_ANSWERED = new Set([...ACTION_TYPES, ...JUDGE_TYPES]);

/** 操作で答える必要があるお知らせか */
export const needsAction = (notification) => !!notification && KEEP_UNTIL_ANSWERED.has(notification.type);

/** まだ読んでいないお知らせか（isRead が無い古いものは未読として扱う） */
export const isUnread = (notification) => !!notification && notification.isRead !== true;

/** ゴミ箱（元に戻す）へ移したお知らせか。お知らせ一覧には出さない */
export const isInTrash = (notification) => !!notification && notification.inTrash === true;

/** 確認を押すだけで過去へ送ってよいお知らせか */
export const canDismiss = (notification) => isUnread(notification) && !needsAction(notification);

const newestFirst = (a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0);

/**
 * 一覧を「いま出すもの」と「過去のもの」に分ける。
 * archiveLimit は過去に出す上限。古いものまで全部出すと画面が重くなるため。
 */
export function splitNotifications(rows = [], { archiveLimit = 50 } = {}) {
  // ゴミ箱へ移したものは、いま出す分にも過去にも出さない（「元に戻す」画面で見る）
  const list = (Array.isArray(rows) ? rows : []).filter((n) => n && !isInTrash(n));
  const active = list.filter(isUnread).sort(newestFirst);
  const archived = list.filter((n) => !isUnread(n)).sort(newestFirst);
  const trashed = (Array.isArray(rows) ? rows : []).filter(isInTrash).sort(newestFirst);
  return {
    active,
    archived: archived.slice(0, archiveLimit),
    archivedTotal: archived.length,
    unreadCount: active.length,
    dismissible: active.filter((n) => !needsAction(n)),
    trashed,
  };
}
