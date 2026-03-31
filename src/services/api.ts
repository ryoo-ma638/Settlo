import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// 🌟 Vite 環境変数を使って、本番とローカルで通信先を自動で切り替える
// ※ 注意: ここには「バックエンド（API）のURL」が入るようにしてください。
// もし Vercel の /api フォルダでバックエンドを動かしているなら、末尾に /api が必要です。
const baseURL = import.meta.env.MODE === 'production' 
  ? 'https://settlo-67zodfg0f-ryoo-ma638s-projects.vercel.app/api' // 🌟 本番用バックエンドURL
  : 'https://settlo-pay-git-csss-ryoo-ma638s-projects.vercel.app/api'; // 🌟 プレビュー用またはローカル用
  // もし手元のパソコンで動かすサーバー(localhost:3001)に繋ぐ場合は以下を有効にします
  // : 'http://localhost:3001/api';

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