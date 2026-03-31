import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// 🌟 URLを直接書かず、「/api」の相対パスにするだけでCORSエラーは完全消滅します！
const baseURL = import.meta.env.MODE === 'production' 
  ? '/api' // Vercel上（本番でもプレビューでも）自動的に今のURLの/apiを叩く
  : 'http://localhost:3001/api'; // パソコンでの開発(npm run dev)の時はこちら

const api = axios.create({
  baseURL: baseURL,
});

// リクエストの直前に毎回Firebaseのトークンをヘッダーに乗せる処理
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const auth = getAuth();

  // 現在のユーザーを取得
  let user = auth.currentUser;

  // もし null なら、少しだけ待機（Firebaseの初期化待ち）
  if (!user) {
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        user = u;
        unsubscribe();
        resolve(true);
      });
    });
  }

  // ユーザーが取得できたらトークンをセット
  if (user) {
    const token = await user.getIdToken(); 
    if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// 🌟 最後に1回だけエクスポートする
export default api;