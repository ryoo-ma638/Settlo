<template>
    <div class="login-container">
      <div class="login-box">
        <h1 class="app-title">Settlo</h1>
        <p class="subtitle">割り勘をもっとスマートに</p>

        <button class="google-login-btn" @click="loginWithGoogle">
          <span class="google-icon">G</span>
          Googleでログイン
        </button>
      </div>
    </div>
  </template>

  <script setup>
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { saveUser } from "../user";
import { useRouter } from "vue-router";

const router = useRouter();

const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);

    // ⭐ ユーザー情報を保存
    await saveUser(result.user);

    console.log("ログイン成功", result.user);
    router.push("/mypage");
  } catch (error) {
    console.error("ログイン失敗", error);
  }
};
</script>

  <style scoped>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh; /* 画面いっぱいの高さ */
    background-color: #f0f4f8; /* アプリ全体の背景色 */
  }
  
  .login-box {
    text-align: center;
    background-color: white;
    padding: 50px 30px;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    width: 80%;
    max-width: 400px;
  }
  
  .app-title {
    font-size: 40px;
    font-weight: bold;
    color: #059669; /* マイページと同じ緑色 */
    margin: 0 0 10px 0;
  }
  
  .subtitle {
    font-size: 14px;
    color: #64748b;
    margin-bottom: 40px;
  }
  
  /* Googleログインボタンのデザイン */
  .google-login-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    background-color: #ffffff;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 30px;
    padding: 12px 0;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: background-color 0.2s;
  }
  
  .google-login-btn:active {
    background-color: #f8fafc;
  }
  
  .google-icon {
    font-size: 20px;
    font-weight: bold;
    color: #4285F4; /* Googleブルー */
    margin-right: 10px;
  }
  </style>