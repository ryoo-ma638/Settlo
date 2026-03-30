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
  const user = auth.currentUser;

  if (user) {
    // 🌟 匿名ログインでも本ログインでも、常に最新の有効なトークンを取得する
    const token = await user.getIdToken(true); 
    if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else {
    console.warn("⚠️ ログインユーザーが見つかりません。");
  }
  return config;
});

export default api;