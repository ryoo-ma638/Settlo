import axios, { InternalAxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
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