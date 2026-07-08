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

      <button class="btn-brand edit__save" :disabled="saving" @click="saveProfile">{{ saving ? '保存中…' : '保存する' }}</button>
    </main>

    <BaseModal
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      @confirm="handleModalConfirm"
      @close="handleModalConfirm"
    />

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
import { ref, reactive, onMounted } from 'vue';
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "vue-router";
import PageHeader from "../components/PageHeader.vue";
import BaseModal from "../components/BaseModal.vue";

const router = useRouter();
const newName = ref("");
const originalName = ref(""); // 変更通知の判定用
const userPhoto = ref("");
const previewPhoto = ref(null);
const selectedFile = ref(null); // アップロード待ちの画像
const saving = ref(false);

const showPhotoOptions = ref(false);
const fileInputLibrary = ref(null);
const fileInputCamera = ref(null);

// 統一モーダル（alert の置き換え）
const modalState = reactive({ show: false, type: 'success', title: '', message: '', onConfirm: null });
const showModal = (type, title, message, onConfirm = null) => {
  Object.assign(modalState, { type, title, message, onConfirm, show: true });
};
const handleModalConfirm = () => {
  const cb = modalState.onConfirm;
  modalState.show = false;
  if (cb) cb();
};

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
    originalName.value = newName.value;
  }
});

const triggerLibrary = () => {
  showPhotoOptions.value = false;
  fileInputLibrary.value.click();
};

const triggerCamera = () => {
  showPhotoOptions.value = false;
  fileInputCamera.value.click(); // カメラの許可はブラウザが確認してくれる
};

const onFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    previewPhoto.value = URL.createObjectURL(file); // まずプレビュー表示（保存時にアップロード）
  }
};

// 🌟 画像を最大512pxに縮小してJPEG化（通信量と表示速度のため）
const resizeImage = (file, max = 512) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の変換に失敗'))), 'image/jpeg', 0.85);
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => reject(new Error('画像の読み込みに失敗'));
  img.src = URL.createObjectURL(file);
});

const saveProfile = async () => {
  const user = auth.currentUser;
  const nameToSave = newName.value.trim();

  if (!nameToSave) {
    showModal('error', '入力エラー', '名前を入力してください');
    return;
  }
  if (!user || saving.value) return;
  saving.value = true;

  try {
    const payload = { name: nameToSave };

    // 🌟 画像が選ばれていれば Firebase Storage にアップロードしてURLを保存
    if (selectedFile.value) {
      const blob = await resizeImage(selectedFile.value);
      const sref = storageRef(getStorage(), `avatars/${user.uid}`);
      await uploadBytes(sref, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(sref);
      payload.photo = url;
      payload.photoURL = url; // 両方のキーを読む画面があるため揃えて保存
    }

    await setDoc(doc(db, "users", user.uid), payload, { merge: true });

    // 🌟 変更内容をフレンド全員へお知らせ（名前変更・画像変更）
    const nameChanged = originalName.value && nameToSave !== originalName.value;
    const photoChanged = !!payload.photo;
    if (nameChanged || photoChanged) {
      let message = '';
      if (nameChanged && photoChanged) message = `名前を「${originalName.value}」から「${nameToSave}」に変更し、プロフィール画像も更新しました`;
      else if (nameChanged) message = `名前を「${originalName.value}」から「${nameToSave}」に変更しました`;
      else message = 'プロフィール画像を変更しました';
      try {
        const friendsSnap = await getDocs(collection(db, "users", user.uid, "friends"));
        for (const f of friendsSnap.docs) {
          try {
            await addDoc(collection(db, "notifications"), {
              toUserId: f.id, type: 'profile_updated',
              message,
              fromUserId: user.uid, fromUserName: nameToSave,
              isRead: false, createdAt: serverTimestamp(),
            });
          } catch (e) {}
        }
      } catch (e) { console.error('プロフィール変更通知の送信に失敗:', e); }
    }

    showModal('success', '保存しました', 'プロフィールを更新しました！', () => router.replace("/mypage"));
  } catch (error) {
    console.error("❌ 保存エラー:", error);
    showModal('error', '保存に失敗しました', '電波状況を確認してもう一度お試しください。');
  } finally {
    saving.value = false;
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
  background: var(--c-overlay);
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
