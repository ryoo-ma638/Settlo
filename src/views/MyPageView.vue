<template>
  <div class="mypage">
    <PageHeader title="マイページ" />

    <main class="mypage__body">
      <section class="profile">
        <UserAvatar class="profile__avatar" :name="userName" :photo="userPhoto" :size="96" />
        <h1 class="profile__name">{{ userName }}</h1>

        <button class="profile__id" @click="copyMyId" :title="userUid">
          <span class="profile__id-label">ID</span>
          <span class="profile__id-value">{{ userUid }}</span>
          <svg class="profile__id-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
        </button>

        <p class="profile__type">{{ accountType }}</p>
      </section>

      <div data-tour="mypage-menu">
        <section class="menu-group" aria-labelledby="menu-0">
          <h2 class="menu-heading" id="menu-0">自分とフレンド</h2>
          <div class="menu">
        <button class="menu__item" data-tour="mp-profile" @click="$router.push('/edit-profile')">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>
          <span class="menu__label">プロフィールを変更</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" data-tour="mp-notify" @click="$router.push('/notification-settings')">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
          <span class="menu__label">通知設定</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" data-tour="mp-friend" @click="$router.push('/friend')">
          <svg class="menu__icon" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.1M17.4 14.2A4 4 0 0 1 20.5 18v1"/></svg>
          <span class="menu__label">フレンド</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
          </div>
        </section>
        <section class="menu-group" aria-labelledby="menu-1">
          <h2 class="menu-heading" id="menu-1">支払いの確認</h2>
          <div class="menu">
        <button class="menu__item" data-tour="mp-history" @click="$router.push('/payment-history')">
          <svg class="menu__icon" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
          <span class="menu__label">お支払い履歴</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" data-tour="mp-approvals" @click="$router.push('/approvals')">
          <svg class="menu__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span class="menu__label">承認待ち</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" data-tour="mp-chats" @click="$router.push('/chats')">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/></svg>
          <span class="menu__label">相談</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" data-tour="mp-trash" @click="$router.push('/trash')">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M3.5 9.5h6v-6"/><path d="M4.2 14.5a8 8 0 1 0 1.1-6"/></svg>
          <span class="menu__label">元に戻す</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
          </div>
        </section>
        <section class="menu-group" aria-labelledby="menu-2">
          <h2 class="menu-heading" id="menu-2">使い方</h2>
          <div class="menu">
        <button class="menu__item" data-tour="mp-help" @click="$router.push('/help')">
          <svg class="menu__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.6c-.8.5-1.2 1-1.2 1.9"/><path d="M12 17h.01"/></svg>
          <span class="menu__label">ヘルプ・使い方</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
          </div>
        </section>
        <!-- お試しの人向け。展示で同じ端末を次の人へ渡すときに使う -->
        <div v-if="isGuest" class="menu menu-logout">
        <button class="menu__item" @click="restartDemo">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
          <span class="menu__label">デモを最初からやり直す</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        <p class="menu-note">新しいお試し用のデータで始めます。いま入っている記録は残りません。次の人に渡すときにお使いください。</p>
        </div>
        <div class="menu menu-logout">
        <button class="menu__item menu__item--danger" @click="logout">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>
          <span class="menu__label">ログアウト</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        </div>
      </div>

      <BaseModal
        :show="confirmState.show"
        type="warning"
        :title="confirmState.title"
        :message="confirmState.message"
        :showCancel="true"
        :confirmText="confirmState.confirmText"
        cancelText="やめる"
        @confirm="runConfirm"
        @cancel="confirmState.show = false"
        @close="confirmState.show = false"
      />
    </main>
  </div>
</template>

<script setup>
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "vue-router";
import { ref, onMounted, nextTick } from "vue";
import { doc, getDoc } from "firebase/firestore";
import PageHeader from "../components/PageHeader.vue";
import BaseModal from "@/components/BaseModal.vue";
import { resetGuestGuide } from "@/lib/guestGuide.js";
import UserAvatar from "../components/UserAvatar.vue";
import { showToast } from "../lib/toast";
import { unregisterPushForCurrentDevice } from '../lib/notificationSettings';

const router = useRouter();
const isGuest = ref(auth.currentUser?.isAnonymous === true);
const confirmState = ref({ show: false, title: '', message: '', confirmText: 'OK', onConfirm: null });
const runConfirm = () => {
  const action = confirmState.value.onConfirm;
  confirmState.value = { ...confirmState.value, show: false };
  if (action) action();
};
const userName = ref("読み込み中...");
const userPhoto = ref("");
const userUid = ref("");
// ログイン方法の表示。匿名認証のゲストに「Google アカウント」と出さない
const accountType = ref("");
const labelOfAccount = (user) => {
  if (!user) return "";
  if (user.isAnonymous) return "ゲスト利用中（デモ）";
  const providers = (user.providerData || []).map(p => p.providerId);
  if (providers.includes("google.com")) return "Google アカウント";
  if (providers.includes("password")) return "メールアドレスでログイン中";
  return "ログイン中";
};

const copyMyId = async () => {
  if (!userUid.value) return;
  try {
    await navigator.clipboard.writeText(userUid.value);
    showToast("IDをコピーしました");
  } catch (err) {
    console.error("コピーに失敗しました", err);
    showToast("コピーに失敗しました。もう一度お試しください");
  }
};

// 🌟 サインアウトの前に、必ずログイン画面へ移す。
//    先にサインアウトすると、開いたままの購読が一斉に権限エラーを出す
//    （読み込めなかった扱いになり、画面に失敗の表示が一瞬出ることがある）。
//    画面を移せば各画面の後片付けで購読が止まるので、そのあとで切る。
const leaveThenSignOut = async () => {
  await router.push('/login');
  await nextTick();
  await signOut(auth);
};

// 🌟 お試しを最初からやり直す。
//    展示で同じ端末を次の人へ渡すとき、前の人が動かしたデータと
//    案内の進み具合が残っていると、次の人が途中から始めることになる。
//    案内の記録を消してからサインアウトすると、次に「ゲストとして試す」を押した人が
//    新しいお試し用のデータと、最初からの案内で始められる。
const restartDemo = () => {
  confirmState.value = {
    show: true,
    title: 'デモを最初からやり直しますか？',
    message: '新しいお試し用のデータで始めます。いま入っている記録は残りません。',
    confirmText: 'やり直す',
    onConfirm: async () => {
      resetGuestGuide();
      try { await leaveThenSignOut(); } catch (e) { console.error('やり直しに失敗しました', e); }
    },
  };
};

const logout = async () => {
  try {
    try { await unregisterPushForCurrentDevice(auth.currentUser?.uid); } catch (e) { console.error('端末通知の解除に失敗しました', e); }
    await leaveThenSignOut();
  } catch (error) {
    console.error("ログアウトエラー", error);
  }
};

onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    userUid.value = user.uid;
    accountType.value = labelOfAccount(user);
    isGuest.value = user.isAnonymous === true;
    try {
      const userDocRef = doc(db, "users", user.uid);
      // プロフィールの用意は App.vue（ログイン直後）に一本化した。
      // ここから呼んでいた /api/users/sync は本番に存在せず、書き換え設定で
      // index.html が返るだけだったため、いつまでも作られなかった。
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        userName.value = data.name || user.displayName || "名無し";
        userPhoto.value = data.photo || user.photoURL || "";
      }
    } catch (error) {
      console.error("❌ データ取得または同期に失敗:", error);
      userName.value = user.displayName;
      userPhoto.value = user.photoURL;
    }
  }
});
</script>

<style scoped>
.mypage__body { padding: 8px var(--pad) 28px; }

/* プロフィール */
.profile {
  text-align: center;
  padding: 16px 0 28px;
}
.profile__avatar {
  display: flex; margin: 0 auto 14px;
  box-shadow: var(--shadow-card);
}
.profile__name { font-size: 22px; font-weight: var(--fw-black); color: var(--c-ink); }

.profile__id {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 80%;
  margin: 12px auto 0;
  padding: 7px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-sm);
}
.profile__id:active { transform: scale(0.97); }
.profile__id-label {
  font-size: 10px; font-weight: var(--fw-bold);
  color: #fff; background: var(--c-text-faint);
  padding: 1px 7px; border-radius: var(--r-pill); flex-shrink: 0;
}
.profile__id-value {
  font-size: 12px; color: var(--c-text-sub); font-weight: var(--fw-medium);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.profile__id-copy {
  width: 15px; height: 15px; flex-shrink: 0;
  fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linejoin: round;
}
.profile__type { margin-top: 10px; font-size: 13px; color: var(--c-text-sub); }

/* メニュー */
.menu {
  background: var(--c-surface);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.menu__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--c-line);
  color: var(--c-ink);
  transition: background-color 0.15s ease;
}
.menu__item:last-child { border-bottom: none; }
.menu__item:active { background: var(--c-surface-2); }
.menu__icon {
  width: 22px; height: 22px; flex-shrink: 0;
  fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
}
.menu__label { flex: 1; text-align: left; font-size: 15px; font-weight: var(--fw-bold); }
/* やり直しの説明。押す前に何が起きるか分かるように */
.menu-note { margin: 8px 4px 0; font-size: 11px; line-height: 1.6; color: var(--c-text-sub); }
.menu__chevron {
  width: 20px; height: 20px; flex-shrink: 0;
  fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.menu__item--danger { color: var(--c-danger); }
.menu__item--danger .menu__icon { stroke: var(--c-danger); }

.menu-group + .menu-group { margin-top: 20px; }
.menu-heading { margin: 0 4px 8px; color: var(--c-text-sub); font-size: 13px; font-weight: var(--fw-bold); }
.menu-logout { margin-top: 24px; }
.profile__name, .menu__label { overflow-wrap: anywhere; }
.menu__item:focus-visible { outline: 2px solid var(--c-brand); outline-offset: -3px; }
</style>
