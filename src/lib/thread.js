// 件（matter）ごとの会話スレッドの共通ユーティリティ
// 「〜の件」を一意に決め、両当事者が同じ threadId に辿り着けるようにする。
import { db } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// 通知（お知らせ）から「件」を一意に決めるキー。
// 両者の通知は同じ実体（イベント/履歴/取引/ゴミ箱）を指すので同じキーになる。
export function subjectKey(notif) {
  if (notif.eventId) return `ev-${notif.eventId}`;
  if (notif.historyId) return `h-${notif.historyId}`;
  if (notif.transactionId) return `t-${notif.transactionId}`;
  if (notif.trashId) return `tr-${notif.trashId}`;
  return 'gen';
}

// 当事者2人＋件キーから決定的な threadId（並べ替えるので双方一致）
export function threadIdFor(uidA, uidB, key) {
  const pair = [uidA, uidB].sort().join('-');
  return `${pair}__${key}`;
}

// 表示用の件ラベル。通知の種類・イベント名・品名・金額から
// 「イベント〇〇の△△のお支払いの件」のように具体的に組み立てる。
export function subjectLabel(notif) {
  const ev = notif.eventName ? `イベント「${notif.eventName}」の` : '';
  const item = notif.itemName ? `「${notif.itemName}」` : '';
  const amt = notif.amount ? `（¥${Number(notif.amount).toLocaleString()}）` : '';
  switch (notif.type) {
    case 'payment_reminder':
    case 'approval_request':
      return `${ev}${item}${amt}のお支払いの件`;
    case 'payment_completed':
      return `${ev}${item}${amt}の精算の件`;
    case 'payment_deleted':
    case 'payment_delete_rejected':
      return `${ev}${item || '支払い'}の削除の件`;
    case 'payment_edited':
      return `${ev}${item || '支払い'}の変更の件`;
    case 'event_invite':
    case 'event_left_check':
    case 'event_left_rejected':
    case 'event_restored':
    case 'event_restore_rejected':
      return notif.eventName ? `イベント「${notif.eventName}」の件` : 'イベントの件';
    case 'settlement_restore_request':
    case 'settlement_restore_rejected':
      return `${item || '決済'}を未精算に戻す件`;
    case 'restore_check':
    case 'restore_reverted':
      return `${ev}${item || '支払い'}の復元の件`;
    default:
      if (item) return `${ev}${item}${amt}の件`;
      return notif.eventName ? `イベント「${notif.eventName}」の件` : '取引の件';
  }
}

// スレッド本体を用意（無ければ作成・あれば更新）
export async function ensureThread(threadId, { myUid, myName, otherUid, otherName, label, eventId }) {
  await setDoc(
    doc(db, 'threads', threadId),
    {
      participants: [myUid, otherUid],
      participantNames: { [myUid]: myName || 'あなた', [otherUid]: otherName || '相手' },
      subjectLabel: label || '取引の件',
      eventId: eventId || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
