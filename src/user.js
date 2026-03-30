import { db } from "./firebase";
import { doc, setDoc, serverTimestamp} from "firebase/firestore";

// ユーザー情報を保存する関数
export const saveUser = async (user) => {
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: user.displayName || "名前なし",
      email: user.email,
      photoURL: user.photoURL || "",
      lastLogin: serverTimestamp()
    }, { merge: true }); // 🌟 merge: true を入れると既存のフレンド情報などを消さずに更新できます
    console.log("ユーザー保存成功");
  } catch (error) {
    console.error("ユーザー保存失敗", error);
  }
};