// 件（matter）ごとの会話スレッドの共通ユーティリティ
// 「〜の件」を一意に決め、両当事者が同じ threadId に辿り着けるようにする。
import { db } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  // イベント名が取引名と同じ（＝旧データでeventNameが取引名にフォールバック）や
  // 汎用語のときは重複を避けて出さない。
  const evName = notif.eventName;
  const showEv = evName && evName !== notif.itemName && evName !== '精算' && evName !== 'イベント';
  const ev = showEv ? `イベント「${evName}」の` : '';
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

// 取引が解決（完了）したら、その取引のスレッド（t-取引ID）を両者の一覧から消す。
// 支払い系の通知（催促・承認）は transactionId で鍵付くので一意にたどれる。
// 新しいメッセージが来たら hiddenBy が [] に戻るので再表示される。
export async function resolveThreadForTx(myUid, otherUid, txId) {
  if (!myUid || !otherUid || !txId) return;
  try {
    const ref = doc(db, 'threads', threadIdFor(myUid, otherUid, `t-${txId}`));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const parts = snap.data().participants || [myUid, otherUid];
      await updateDoc(ref, { hiddenBy: parts, resolved: true });
    }
  } catch (e) { /* スレッドが無ければ何もしない */ }
}

// スレッド本体を用意（無ければ作成・あれば更新）
export async function ensureThread(threadId, { myUid, myName, otherUid, otherName, label, eventId }) {
  const payload = {
    participants: [myUid, otherUid],
    participantNames: { [myUid]: myName || 'あなた', [otherUid]: otherName || '相手' },
    eventId: eventId || null,
    updatedAt: serverTimestamp(),
  };
  // 🌟 具体的な件名があるときだけ subjectLabel を更新する。
  //    汎用の「取引の件」や空で上書きすると、一覧から開いて送信しただけで
  //    せっかくの件名が汎用に降格してしまうため（merge で毎回書かれる）。
  if (label && label !== '取引の件') payload.subjectLabel = label;
  await setDoc(doc(db, 'threads', threadId), payload, { merge: true });
}
