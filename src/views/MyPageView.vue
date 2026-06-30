<template>
  <div class="mypage">
    <PageHeader title="マイページ" />

    <main class="mypage__body">
      <section class="profile">
        <div class="profile__avatar">
          <img v-if="userPhoto" :src="userPhoto" alt="" />
          <div v-else class="profile__ph"></div>
        </div>
        <h1 class="profile__name">{{ userName }}</h1>

        <button class="profile__id" @click="copyMyId" :title="userUid">
          <span class="profile__id-label">ID</span>
          <span class="profile__id-value">{{ userUid }}</span>
          <svg class="profile__id-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
        </button>

        <p class="profile__type">Google アカウント</p>
      </section>

      <section class="menu">
        <button class="menu__item" @click="$router.push('/edit-profile')">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>
          <span class="menu__label">プロフィールを変更</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" @click="$router.push('/friend')">
          <svg class="menu__icon" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.1M17.4 14.2A4 4 0 0 1 20.5 18v1"/></svg>
          <span class="menu__label">フレンド管理</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item" @click="$router.push('/payment-history')">
          <svg class="menu__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
          <span class="menu__label">お支払い履歴</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>

        <button class="menu__item menu__item--danger" @click="logout">
          <svg class="menu__icon" viewBox="0 0 24 24"><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>
          <span class="menu__label">ログアウト</span>
          <svg class="menu__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </section>
    </main>
  </div>
</template>

<script setup>
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "vue-router";
import { ref, onMounted } from "vue";
import { doc, getDoc } from "firebase/firestore";
import api from "../services/api";
import PageHeader from "../components/PageHeader.vue";

const router = useRouter();
const userName = ref("読み込み中...");
const userPhoto = ref("");
const userUid = ref("");

const copyMyId = async () => {
  if (!userUid.value) return;
  try {
    await navigator.clipboard.writeText(userUid.value);
    alert("IDをコピーしました！: " + userUid.value);
  } catch (err) {
    console.error("コピーに失敗しました", err);
    alert("コピーに失敗しました。");
  }
};

const logout = async () => {
  try {
    await signOut(auth);
    router.push("/login");
  } catch (error) {
    console.error("ログアウトエラー", error);
  }
};

onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    userUid.value = user.uid;
    try {
      const userDocRef = doc(db, "users", user.uid);
      let userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await api.post('/users/sync');
        userSnap = await getDoc(userDocRef);
      }
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
  width: 96px; height: 96px; margin: 0 auto 14px;
  border-radius: 50%; overflow: hidden;
  background: var(--c-brand-tint);
  box-shadow: var(--shadow-card);
}
.profile__avatar img { width: 100%; height: 100%; object-fit: cover; }
.profile__ph { width: 100%; height: 100%; background: var(--c-brand-tint); }
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
.menu__chevron {
  width: 20px; height: 20px; flex-shrink: 0;
  fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
}
.menu__item--danger { color: var(--c-danger); }
.menu__item--danger .menu__icon { stroke: var(--c-danger); }
</style>
