import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// Vite 環境変数 VITE_API_BASE_URL を優先し、未定義ならローカルの server.js (port 3000) を使う
// TypeScript 環境で import.meta.env の型がない場合があるため any キャストで安全に参照する
const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE_URL) || 'http://localhost:3001/api';
const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const auth = getAuth();

  // 現在のユーザーを取得
  let user = auth.currentUser;

  // もし null なら、少しだけ待機（初期化待ち）
  if (!user) {
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        user = u;
        unsubscribe();
        resolve(true);
      });
    });
  }

  if (user) {
    const token = await user.getIdToken(); 
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, () => {
  return Promise.reject(new Error('リクエストの設定に失敗しました'));
});


export default api;