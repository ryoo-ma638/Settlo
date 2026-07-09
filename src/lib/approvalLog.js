// 承認・拒否の履歴を残す共通ヘルパー（お知らせとは別に、消えない記録として残す）
// approvalHistory/{id}: { userId(所有者), role('byMe'|'toMe'), kind('payment'|'friend'|'settlement'),
//                          outcome('approved'|'rejected'), otherName, itemName, amount, createdAt }
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

async function write(entry) {
  try {
    await addDoc(collection(db, 'approvalHistory'), { ...entry, createdAt: serverTimestamp() });
  } catch (e) { console.error('承認履歴の記録に失敗:', e); }
}

// 双方に記録：自分視点(byMe=決めた側)と相手視点(toMe=決められた側)
export async function logApprovalBoth({ myUid, myName, otherUid, otherName, kind, outcome, itemName = '', amount = 0 }) {
  if (myUid) await write({ userId: myUid, role: 'byMe', kind, outcome, otherName: otherName || '相手', itemName, amount });
  if (otherUid) await write({ userId: otherUid, role: 'toMe', kind, outcome, otherName: myName || '相手', itemName, amount });
}
