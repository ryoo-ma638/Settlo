import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { buildNewUserProfile } from "./lib/userProfile";

// ログインのたびに呼ばれる。users/{uid} を用意する。
//
// ⚠️ 以前は毎回 name を Googleの表示名で上書きしていた。
//    そのため、プロフィール編集でニックネームに変えても、次にログインすると
//    Googleの名前へ戻ってしまっていた。
//    名前・画像は「まだ無いとき」だけ書く。毎回書き換えてよいのは lastLogin だけ。
export const saveUser = async (user) => {
  if (!user || !user.uid) return;
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const payload = snap.exists()
      ? { uid: user.uid, lastLogin: serverTimestamp() }
      : { ...buildNewUserProfile(user), lastLogin: serverTimestamp() };
    // まだ入っていない項目だけ足す（あとから変えた値は消さない）
    if (snap.exists()) {
      const data = snap.data() || {};
      if (!data.name) payload.name = user.displayName || "名前なし";
      if (!data.email && user.email) payload.email = user.email;
      // 画像を読むキーが画面によって違うので、片方しか無いときはそろえる
      if (!data.photo && (data.photoURL || user.photoURL)) payload.photo = data.photoURL || user.photoURL;
      if (!data.photoURL && (data.photo || user.photoURL)) payload.photoURL = data.photo || user.photoURL;
    }
    await setDoc(ref, payload, { merge: true });
  } catch (error) {
    console.error("ユーザー保存失敗", error);
  }
};
