import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const auth = getAuth();
  
  // 🌟 currentUser が null の場合に備え、少し待機するか判定を入れるのが安全です
  const user = auth.currentUser;

  if (user) {
    try {
      // 🌟 第1引数を true にすると強制リフレッシュされます。
      // 通常は false (または引数なし) でOKですが、期限切れを防ぐなら有効です。
      const token = await user.getIdToken(); 
      config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.error("トークンの取得に失敗しました:", error);
    }
  } else {
    // ログインしていない状態でのリクエスト。
    // 新規登録などのAPIならそのまま通してOKです。
    console.warn("⚠️ ログインユーザーが見つかりません。");
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;