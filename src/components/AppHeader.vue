<template>
  <header class="topbar">
    <button class="topbar__avatar" @click="navigate('/mypage')" aria-label="マイページ">
      <img v-if="userPhoto" :src="userPhoto" alt="" />
      <span v-else class="topbar__avatar-fallback">{{ initial }}</span>
    </button>

    <h1 class="topbar__brand" @click="navigate('/')">Settlo</h1>

    <div class="topbar__right">
      <button class="topbar__chat" @click="navigate('/chats')" aria-label="チャット">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 11.5a8.4 8.4 0 0 1-11.9 7.6L3 21l1.9-6.1A8.4 8.4 0 1 1 21 11.5z"/>
        </svg>
        <span v-if="chatUnread > 0" class="topbar__chat-badge">{{ chatUnread > 99 ? '99+' : chatUnread }}</span>
      </button>
      <button class="topbar__help" @click="navigate('/help')" aria-label="ヘルプ">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.6c-.8.5-1.2 1-1.2 1.9"/>
          <path d="M12 17h.01"/>
        </svg>
      </button>
      <NotificationIcon ref="notifRef" />
    </div>
  </header>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import NotificationIcon from './NotificationIcon.vue';
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";

const router = useRouter();
const notifRef = ref(null);
const userName = ref("");
const userPhoto = ref("");
const chatUnread = ref(0); // チャットの合計未読件数

const initial = computed(() => (userName.value || "U").trim().charAt(0).toUpperCase());

const navigate = (path) => { router.push(path); };

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          userName.value = data.name || user.displayName || "";
          userPhoto.value = data.photo || user.photoURL || "";
        }
      });
      // チャットの合計未読件数を購読
      const tq = query(collection(db, "threads"), where("participants", "array-contains", user.uid));
      onSnapshot(tq, (snap) => {
        let n = 0;
        snap.docs.forEach((d) => { const t = d.data(); n += (t.unread && t.unread[user.uid]) || 0; });
        chatUnread.value = n;
      }, () => {});
    }
  });
});
</script>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  height: var(--header-h);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 16px;
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-line);
}

.topbar__avatar {
  justify-self: start;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--c-brand-tint);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease;
}
.topbar__avatar:active { transform: scale(0.92); }
.topbar__avatar img { width: 100%; height: 100%; object-fit: cover; }
.topbar__avatar-fallback {
  font-size: 15px;
  font-weight: var(--fw-bold);
  color: var(--c-brand-strong);
}

.topbar__brand {
  font-size: 22px;
  font-weight: var(--fw-black);
  letter-spacing: 0.03em;
  color: var(--c-brand-strong);
  cursor: pointer;
}

.topbar__right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 2px;
}

.topbar__help, .topbar__chat {
  width: 38px; height: 38px;
  display: flex; align-items: center; justify-content: center;
  color: var(--c-text-sub);
  background: none; border: none;
  border-radius: 50%;
}
.topbar__help:active, .topbar__chat:active { background: var(--c-surface-2); transform: scale(0.94); }
.topbar__chat { position: relative; }
.topbar__chat-badge {
  position: absolute; top: 2px; right: 2px;
  min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
  background: var(--c-danger); color: #fff; font-size: 10px; font-weight: var(--fw-black);
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
}
</style>
