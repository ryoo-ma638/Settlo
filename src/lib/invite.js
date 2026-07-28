// イベント招待（event_invite 通知）の共通処理。
// お知らせベルだけでなく、イベント一覧・ホームの招待カードからも同じ手順で参加/辞退できるようにする。
// 手順は既存のお知らせベルと同じ：
//   参加 … events.participants に自分を追加 → 既存メンバーへ event_joined 通知 → 招待通知を既読化
//   辞退 … 招待した人へ invite_rejected 通知 → 招待通知を既読化

import { db, auth } from '@/firebase';
import {
  collection, doc, addDoc, getDoc, updateDoc,
  query, where, onSnapshot, arrayUnion, serverTimestamp,
} from 'firebase/firestore';

// 自分の表示名（通知の差出人名に使う）
const myDisplayName = async (uid) => {
  let name = auth.currentUser?.displayName || 'メンバー';
  if (!uid) return name;
  try {
    const md = await getDoc(doc(db, 'users', uid));
    if (md.exists() && md.data().name) name = md.data().name;
  } catch (e) { /* 名前が取れなくても処理は続ける */ }
  return name;
};

// 未処理（未読）のイベント招待を監視する。
// クエリ条件はお知らせベルと同じ（toUserId + isRead）にして、種類の絞り込みは受け取り側で行う。
// 戻り値は購読解除の関数。
export function subscribePendingInvites(uid, onChange) {
  if (!uid) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', uid),
    where('isRead', '==', false),
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((n) => n.type === 'event_invite' && n.eventId)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // 新しい順
    onChange(list);
  }, () => { onChange([]); });
}

// 招待を受ける＝自分をイベント参加者に追加し、既存メンバーへ参加をお知らせする。
// 成功したら { ok: true, eventId } を返す。
export async function acceptEventInvite(invite) {
  const myUid = auth.currentUser?.uid;
  if (!myUid || !invite?.eventId) return { ok: false, eventId: null };

  // 追加する前の参加者を控える（この人たちにお知らせを送る）
  let existing = [];
  let evName = invite.eventName || '';
  try {
    const ev = await getDoc(doc(db, 'events', invite.eventId));
    if (ev.exists()) {
      existing = ev.data().participants || [];
      evName = ev.data().name || evName;
    }
  } catch (e) { /* 読めなくても通知の内容で続行する */ }

  await updateDoc(doc(db, 'events', invite.eventId), { participants: arrayUnion(myUid) });

  const myName = await myDisplayName(myUid);
  for (const uid of existing) {
    if (uid === myUid) continue;
    try {
      await addDoc(collection(db, 'notifications'), {
        toUserId: uid,
        type: 'event_joined',
        eventId: invite.eventId,
        eventName: evName,
        fromUserId: myUid,
        fromUserName: myName,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) { /* 1人分の通知が失敗しても参加自体は成立させる */ }
  }

  if (invite.id) {
    try { await updateDoc(doc(db, 'notifications', invite.id), { isRead: true }); } catch (e) {}
  }
  return { ok: true, eventId: invite.eventId };
}

// 招待を辞退＝招待した人へお知らせを送り、招待通知を既読にする。
export async function rejectEventInvite(invite, reason = '') {
  const myUid = auth.currentUser?.uid;
  const myName = await myDisplayName(myUid);
  if (invite?.fromUserId) {
    await addDoc(collection(db, 'notifications'), {
      toUserId: invite.fromUserId,
      type: 'invite_rejected',
      eventId: invite.eventId || null,
      eventName: invite.eventName || '',
      fromUserId: myUid || 'unknown',
      fromUserName: myName,
      userMessage: reason || null,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }
  if (invite?.id) {
    await updateDoc(doc(db, 'notifications', invite.id), { isRead: true });
  }
  return { ok: true };
}
