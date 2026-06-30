<template>
  <div class="login">
    <div class="login__inner">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">
          <span>¥</span>
        </div>
        <h1 class="brand__name">Settlo</h1>
        <p class="brand__tag">割り勘を、もっとスマートに。</p>
      </div>

      <div class="login__actions">
        <button class="gbtn" @click="loginWithGoogle">
          <svg class="gbtn__logo" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          <span>Google でログイン</span>
        </button>
        <p class="login__note">続行すると、利用規約とプライバシーポリシーに同意したものとみなされます。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { saveUser } from "../user";

const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await saveUser(user);
    console.log("ログイン成功", user);
  } catch (error) {
    console.error("ログイン失敗", error);
  }
};
</script>

<style scoped>
.login {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--c-surface);
  padding: 56px 28px 40px;
}

.login__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 56px;
}

/* --- ブランド --- */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.brand__mark {
  width: 76px;
  height: 76px;
  border-radius: 22px;
  background: var(--c-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(5, 150, 105, 0.32);
  margin-bottom: 22px;
}
.brand__mark span {
  color: #fff;
  font-size: 40px;
  font-weight: var(--fw-black);
  line-height: 1;
  transform: translateY(-1px);
}

.brand__name {
  font-size: 40px;
  font-weight: var(--fw-black);
  letter-spacing: 0.02em;
  color: var(--c-brand-strong);
  margin: 0;
}

.brand__tag {
  margin-top: 8px;
  font-size: 15px;
  font-weight: var(--fw-medium);
  color: var(--c-text-sub);
}

/* --- アクション --- */
.login__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.gbtn {
  width: 100%;
  max-width: 340px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 15px 20px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  box-shadow: var(--shadow-sm);
  color: var(--c-ink);
  font-size: 16px;
  font-weight: var(--fw-bold);
  transition: transform 0.12s ease, background-color 0.2s ease;
}
.gbtn:active {
  transform: scale(0.98);
  background: var(--c-surface-2);
}
.gbtn__logo { flex-shrink: 0; }

.login__note {
  max-width: 300px;
  text-align: center;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-text-faint);
}
</style>
