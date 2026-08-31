<template>
  <div class="login">
    <div class="login__inner">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">
          <img :src="logoMark" alt="">
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

        <button class="guest-btn" :disabled="guestLoading" @click="loginAsGuest">
          <svg class="guest-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>
          <span>{{ guestLoading ? 'デモを準備中…' : 'ゲストとして試す（デモ）' }}</span>
        </button>
        <p class="guest-note">登録なしでOK。デモ用のイベント・精算が用意された状態ですぐに体験できます。</p>

        <p v-if="loginError" class="guest-error">{{ loginError }}</p>
        <p v-if="guestError" class="guest-error">{{ guestError }}</p>
        <p class="login__note">続行すると、利用規約とプライバシーポリシーに同意したものとみなされます。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { auth, provider, functions } from "../firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, signInAnonymously, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { onMounted } from "vue";
import { saveUser } from "../user";
import logoMark from "../assets/logo-mark.png";

const router = useRouter();

const guestLoading = ref(false);
const guestError = ref("");
const loginError = ref("");

// ゲスト準備に失敗してログイン画面に戻された時、理由を出し直すための置き場
const GUEST_ERROR_KEY = "settlo_guest_error";
const GUEST_ERROR_TEXT = "ゲストログインに失敗しました。時間をおいてもう一度お試しください。";

// 🌟 ホーム画面に追加した「アプリ版（PWA）」で動いているか
//    アプリ版は独立ウィンドウのためポップアップが開けず、リダイレクト方式でログインする
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const loginWithGoogle = async () => {
  loginError.value = "";
  try {
    if (isStandalone()) {
      // アプリ版：同じ画面内で Google に移動して戻ってくる方式
      await signInWithRedirect(auth, provider);
      return;
    }
    const result = await signInWithPopup(auth, provider);
    await saveUser(result.user);
    console.log("ログイン成功", result.user);
  } catch (error) {
    console.error("ログイン失敗", error);
    // ポップアップが開けない環境ではリダイレクト方式に自動で切り替える
    const popupIssues = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request", "auth/popup-closed-by-user"];
    if (popupIssues.includes(error?.code) && error?.code !== "auth/popup-closed-by-user") {
      try { await signInWithRedirect(auth, provider); return; } catch (e) { console.error(e); }
    }
    if (error?.code !== "auth/popup-closed-by-user") {
      loginError.value = "ログインに失敗しました。もう一度お試しください。";
    }
  }
};

// 🌟 リダイレクト方式で Google から戻ってきた時の受け取り
onMounted(async () => {
  // ゲスト準備に失敗して戻された直後なら、その理由を表示する
  try {
    const saved = sessionStorage.getItem(GUEST_ERROR_KEY);
    if (saved) {
      guestError.value = saved;
      sessionStorage.removeItem(GUEST_ERROR_KEY);
    }
  } catch (e) { /* sessionStorage が使えない環境では出さない */ }

  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await saveUser(result.user);
      console.log("ログイン成功（リダイレクト）", result.user);
    }
  } catch (e) {
    console.error("リダイレクトログイン失敗", e);
    loginError.value = "ログインに失敗しました。もう一度お試しください。";
  }
});

// 🌟 ゲスト（お試し）ログイン：匿名認証→サーバーがデモ環境を一式用意
const loginAsGuest = async () => {
  if (guestLoading.value) return;
  guestLoading.value = true;
  guestError.value = "";
  try {
    await signInAnonymously(auth);
    const setup = httpsCallable(functions, "setupGuestDemo");
    await setup({});
    // 準備が終わったらホームから体験を始めてもらう
    router.replace("/");
  } catch (error) {
    console.error("ゲストログイン失敗", error);
    guestError.value = GUEST_ERROR_TEXT;
    // 匿名ログインだけ通ってデモ準備に失敗すると、App.vue がログインを検知して
    // ホームへ移動させるため、中身が空のゲストのまま取り残されてしまう。
    // その状態を残さないようサインアウトし、理由を添えてログイン画面へ戻す。
    if (auth.currentUser?.isAnonymous) {
      try { sessionStorage.setItem(GUEST_ERROR_KEY, GUEST_ERROR_TEXT); } catch (e) { /* 保存できなくても続行 */ }
      try { await signOut(auth); } catch (e) { console.error("ゲストのサインアウトに失敗", e); }
    }
  } finally {
    guestLoading.value = false;
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
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22px;
}
.brand__mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 24px rgba(5, 150, 105, 0.32));
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

/* 🌟 ゲストログイン */
.guest-btn {
  width: 100%;
  max-width: 340px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px 20px;
  border-radius: var(--r-pill);
  background: var(--c-brand);
  border: none;
  box-shadow: 0 6px 16px rgba(5, 150, 105, 0.3);
  color: #fff;
  font-size: 16px;
  font-weight: var(--fw-bold);
  transition: transform 0.12s ease;
}
.guest-btn:active { transform: scale(0.98); }
.guest-btn:disabled { opacity: 0.7; }
.guest-btn__icon {
  width: 19px; height: 19px; flex-shrink: 0;
  fill: none; stroke: #fff; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;
}
.guest-note {
  max-width: 300px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  color: var(--c-text-sub);
  margin: 0;
}
.guest-error {
  max-width: 300px;
  text-align: center;
  font-size: 12px;
  color: var(--c-danger, var(--c-danger-strong));
  font-weight: var(--fw-bold);
  margin: 0;
}

.login__note {
  max-width: 300px;
  text-align: center;
  font-size: 11px;
  line-height: 1.7;
  color: var(--c-text-faint);
}
</style>
