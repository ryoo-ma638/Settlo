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

// 表示用の件ラベル（「居酒屋まる（¥8,400）の件」など）
export function subjectLabel(notif) {
  const name = notif.itemName || notif.eventName || '取引';
  const amt = notif.amount ? `¥${Number(notif.amount).toLocaleString()}` : '';
  return amt ? `${name}（${amt}）の件` : `${name}の件`;
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
