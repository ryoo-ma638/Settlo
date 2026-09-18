// 表示名（お知らせ・チャットに載せる名前）を1か所で解決する。
// 正データは users/{uid}.name。匿名ログイン（ゲスト）だと Firebase Auth の displayName が空なので、
// displayName だけを頼りにすると「あなた」「自分」といった一人称が相手の画面に出てしまう。
import { db, auth } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

const FALLBACK = 'メンバー';

// 一人称の判定は selfName.js を正とする（定義を2か所に置かない）
export { isSelfName, SELF_WORDS } from './selfName.js';
import { isSelfName } from './selfName.js';

// uid → 名前（1セッション内はキャッシュして読み込みを減らす）
const cache = new Map();

// プロフィール更新時に呼ぶ（キャッシュを捨てて次回に読み直す）
export function clearUserNameCache(uid) {
  if (uid) cache.delete(uid);
  else cache.clear();
}

// 相手（または自分）の名前を users から引く。見つからなければ fallback。
export async function getUserName(uid, fallback = FALLBACK) {
  if (!uid) return fallback;
  if (cache.has(uid)) return cache.get(uid);
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const name = snap.exists() ? (snap.data().name || '') : '';
    if (name && !isSelfName(name)) {
      cache.set(uid, name);
      return name;
    }
  } catch (e) { /* 読めなければ fallback */ }
  return fallback;
}

// 自分の名前（お知らせの fromUserName に入れる値）
export async function getMyName(fallback = FALLBACK) {
  const me = auth.currentUser;
  if (!me) return fallback;
  const fromDoc = await getUserName(me.uid, '');
  if (fromDoc) return fromDoc;
  const dn = me.displayName;
  return isSelfName(dn) ? fallback : dn;
}
