// 件（matter）ごとの会話スレッドの共通ユーティリティ
// 「〜の件」を一意に決め、両当事者が同じ threadId に辿り着けるようにする。
import { db } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, addDoc, increment } from 'firebase/firestore';

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

// ========== 支払い（立て替え1件）ごとのグループチャット ==========
// 割り勘の1件につき1つのチャット。参加者＝立替者＋割り勘の全員。
// 立て替えを追加した瞬間に作られ、経緯（催促・支払い・承認・拒否・完了）を
// システムメッセージとして流す。全員が精算し終えると自動で片付く。

export function paymentThreadId(historyId) { return `pay-${historyId}`; }

// 表示用の件名：「イベント名・立替名（¥金額）のお支払いの件」
export function paymentSubject({ eventName, itemName, amount }) {
  const ev = eventName && eventName !== itemName ? `${eventName}・` : '';
  const amt = amount ? `（¥${Number(amount).toLocaleString()}）` : '';
  return `${ev}${itemName || '立て替え'}${amt}のお支払いの件`;
}

// 立て替え追加時にグループチャットを用意する（参加者2人以上のときだけ）
export async function ensurePaymentThread(historyId, info) {
  const { participants = [], participantNames = {}, creditorUid, eventId, eventName, itemName, amount, transactionIds = [] } = info || {};
  if (!historyId || participants.length < 2) return null;
  const id = paymentThreadId(historyId);
  const unread = {}; participants.forEach(u => { unread[u] = 0; });
  await setDoc(doc(db, 'threads', id), {
    type: 'payment',
    participants,
    participantNames,
    creditorUid: creditorUid || null,
    eventId: eventId || null,
    eventName: eventName || '',
    itemName: itemName || '',
    amount: amount || 0,
    transactionIds,
    subjectLabel: paymentSubject({ eventName, itemName, amount }),
    lastMessage: '立て替えを記録しました',
    hiddenBy: [],
    resolved: false,
    unread,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
}

// 取引ID(txId)から historyId を引いて、グループチャットに経緯を流す
export async function postPaymentEventByTx(txId, opts) {
  if (!txId) return;
  try {
    const t = await getDoc(doc(db, 'transactions', txId));
    if (!t.exists() || !t.data().historyId) return;
    await postPaymentEvent(t.data().historyId, opts);
  } catch (e) { /* 失敗しても本処理は止めない */ }
}

// グループチャットにシステムメッセージ（経緯）を1件流す
export async function postPaymentEvent(historyId, { text, kind, actorUid } = {}) {
  if (!historyId || !text) return;
  const id = paymentThreadId(historyId);
  try {
    const ref = doc(db, 'threads', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return; // グループチャットが無ければ何もしない
    const parts = snap.data().participants || [];
    await addDoc(collection(db, 'threads', id, 'messages'), {
      system: true, kind: kind || 'info', text,
      fromUid: actorUid || null,
      createdAt: serverTimestamp(),
      readBy: actorUid ? [actorUid] : [],
    });
    // プレビュー更新＋自分以外の未読を増やす＋片付けを解除（新しい動きがあったので再表示）
    const patch = { lastMessage: text, updatedAt: serverTimestamp(), hiddenBy: [], resolved: false };
    parts.forEach(u => { if (u !== actorUid) patch[`unread.${u}`] = increment(1); });
    await updateDoc(ref, patch);
  } catch (e) { /* 失敗しても本処理は止めない */ }
}

// 取引ID経由で「全部完了なら片付ける」
export async function resolvePaymentThreadByTx(txId) {
  if (!txId) return;
  try {
    const t = await getDoc(doc(db, 'transactions', txId));
    if (t.exists() && t.data().historyId) await resolvePaymentThreadIfDone(t.data().historyId);
  } catch (e) { /* 失敗しても本処理は止めない */ }
}

// 全取引が完了したらグループチャットを片付ける（一覧から消す）
export async function resolvePaymentThreadIfDone(historyId) {
  if (!historyId) return;
  const id = paymentThreadId(historyId);
  try {
    const ref = doc(db, 'threads', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const txIds = snap.data().transactionIds || [];
    if (txIds.length === 0) return;
    for (const tid of txIds) {
      const t = await getDoc(doc(db, 'transactions', tid));
      if (t.exists() && (t.data().status || 'unpaid') !== 'completed') return; // まだ未完了あり
    }
    const parts = snap.data().participants || [];
    await updateDoc(ref, { hiddenBy: parts, resolved: true });
  } catch (e) { /* 失敗しても本処理は止めない */ }
}
