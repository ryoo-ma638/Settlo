<template>
  <div class="edit">
    <PageHeader title="プロフィール編集" fallback="/mypage" />

    <main class="edit__body">
      <div class="edit__avatar-area">
        <div class="edit__avatar">
          <img :src="previewPhoto || userPhoto" alt="" />
        </div>
        <button class="edit__upload" @click="showPhotoOptions = true">
          <svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
          画像を変更
        </button>
      </div>

      <div class="field">
        <label class="field__label">名前</label>
        <input type="text" v-model="newName" class="input" placeholder="新しい名前を入力" />
      </div>

      <button class="btn-brand edit__save" @click="saveProfile">保存する</button>
    </main>

    <Teleport to="body">
      <transition name="sheet">
        <div v-if="showPhotoOptions" class="overlay" @click.self="showPhotoOptions = false">
          <div class="sheet">
            <button class="sheet__btn" @click="triggerCamera">
              <svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
              カメラで撮影
            </button>
            <button class="sheet__btn" @click="triggerLibrary">
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/></svg>
              アルバムから選ぶ
            </button>
            <button class="sheet__btn sheet__btn--cancel" @click="showPhotoOptions = false">キャンセル</button>
          </div>
        </div>
      </transition>
    </Teleport>

    <input ref="fileInputLibrary" type="file" accept="image/*" style="display: none;" @change="onFileChange" />
    <input ref="fileInputCamera" type="file" accept="image/*" capture="environment" style="display: none;" @change="onFileChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "vue-router";
import PageHeader from "../components/PageHeader.vue";

const router = useRouter();
const newName = ref("");
const userPhoto = ref("");
const previewPhoto = ref(null);

const showPhotoOptions = ref(false);
const fileInputLibrary = ref(null);
const fileInputCamera = ref(null);

onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      newName.value = data.name || "";
      userPhoto.value = data.photo || "";
    } else {
      newName.value = user.displayName || "";
      userPhoto.value = user.photoURL || "";
    }
  }
});

const triggerLibrary = () => {
  showPhotoOptions.value = false;
  fileInputLibrary.value.click();
};

const triggerCamera = () => {
  showPhotoOptions.value = false;
  if (confirm("Settlo がカメラへのアクセスを求めています。\n許可しますか？")) {
    fileInputCamera.value.click();
  }
};

const onFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    previewPhoto.value = URL.createObjectURL(file);
    // TODO: 後でここにFirebaseへのアップロード処理を書く
  }
};

const saveProfile = async () => {
  const user = auth.currentUser;
  const nameToSave = newName.value.trim();

  if (!nameToSave) {
    alert("名前を入力してください");
    return;
  }

  try {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        name: nameToSave,
      });

      alert("プロフィールを保存しました！");
      router.replace("/mypage");
    }
  } catch (error) {
    console.error("❌ 保存エラー:", error);
    alert("保存に失敗しました。サーバーが起動しているか確認してください。");
  }
};
</script>

<style scoped>
.edit__body { padding: 12px var(--pad) 28px; }

.edit__avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 8px 0 26px;
}
.edit__avatar {
  width: 110px; height: 110px; border-radius: 50%;
  overflow: hidden; background: var(--c-brand-tint);
  box-shadow: var(--shadow-card); margin-bottom: 14px;
}
.edit__avatar img { width: 100%; height: 100%; object-fit: cover; }
.edit__upload {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--c-surface); border: 1px solid var(--c-line-bold);
  padding: 9px 16px; border-radius: var(--r-pill);
  font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text);
  box-shadow: var(--shadow-sm);
}
.edit__upload:active { transform: scale(0.97); }
.edit__upload svg {
  width: 17px; height: 17px;
  fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linejoin: round;
}

.field { margin-bottom: 22px; }
.field__label {
  display: block; font-size: 13px; font-weight: var(--fw-bold);
  color: var(--c-text-sub); margin-bottom: 8px;
}
.input {
  width: 100%;
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-md);
  padding: 14px 16px;
  font-size: 15px;
  font-weight: var(--fw-medium);
  color: var(--c-ink);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input::placeholder { color: var(--c-text-faint); font-weight: var(--fw-regular); }
.input:focus {
  outline: none;
  border-color: var(--c-brand);
  box-shadow: 0 0 0 3px var(--c-brand-weak);
}

.edit__save { margin-top: 6px; }

/* アクションシート */
.overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: flex-end;
  z-index: 3000;
}
.sheet {
  background: var(--c-bg);
  width: 100%;
  max-width: var(--app-max);
  margin: 0 auto;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0));
  border-radius: var(--r-xl) var(--r-xl) 0 0;
}
.sheet__btn {
  width: 100%;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 16px;
  background: var(--c-surface);
  border-radius: var(--r-md);
  font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink);
  margin-bottom: 10px;
  box-shadow: var(--shadow-sm);
}
.sheet__btn:active { transform: scale(0.98); }
.sheet__btn svg {
  width: 19px; height: 19px;
  fill: none; stroke: var(--c-brand); stroke-width: 1.8; stroke-linejoin: round;
}
.sheet__btn--cancel { background: var(--c-surface-2); color: var(--c-text-sub); margin-top: 6px; margin-bottom: 0; }

.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
