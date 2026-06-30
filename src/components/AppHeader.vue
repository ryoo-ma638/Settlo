<template>
  <header class="topbar">
    <button class="topbar__avatar" @click="navigate('/mypage')" aria-label="マイページ">
      <img v-if="userPhoto" :src="userPhoto" alt="" />
      <span v-else class="topbar__avatar-fallback">{{ initial }}</span>
    </button>

    <h1 class="topbar__brand" @click="navigate('/')">Settlo</h1>

    <div class="topbar__right">
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
import { doc, onSnapshot } from "firebase/firestore";

const router = useRouter();
const notifRef = ref(null);
const userName = ref("");
const userPhoto = ref("");

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
}
</style>
