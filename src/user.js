import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

// ユーザー情報を保存する関数
export const saveUser = async (user) => {
  try {
    await setDoc(doc(db, "users", user.uid), {
      name: user.displayName,
      email: user.email,
      photo: user.photoURL
    });
    console.log("ユーザー保存成功");
  } catch (error) {
    console.error("ユーザー保存失敗", error);
  }
};