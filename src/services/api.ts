import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

// Vite 環境変数 VITE_API_BASE_URL を優先し、未定義ならローカルの server.js (port 3000) を使う
// TypeScript 環境で import.meta.env の型がない場合があるため any キャストで安全に参照する
const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE_URL) || 'http://localhost:3000/api';
const api = axios.create({
  baseURL: API_BASE,
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
}, () => {
  return Promise.reject(new Error('リクエストの設定に失敗しました'));
});

export default api;