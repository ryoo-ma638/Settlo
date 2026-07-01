<template>
  <div class="make-event">
    <PageHeader :title="isJoinMode ? 'イベントに参加' : '新規イベント作成'" />

    <main class="body">
      <!-- 🌟 作成／参加をひと目で切り替えられるタブ -->
      <div class="seg mode-seg">
        <button class="seg__item" :class="{ 'is-active': !isJoinMode }" @click="isJoinMode = false">イベントを作る</button>
        <button class="seg__item" :class="{ 'is-active': isJoinMode }" @click="isJoinMode = true">参加する</button>
      </div>

      <div v-if="!isJoinMode">
        <div class="field">
          <label class="field__label">イベント名</label>
          <input v-model="eventName" type="text" placeholder="例：キャンプ、飲み会" class="input" />
        </div>

        <div class="field">
          <label class="field__label">メモ</label>
          <textarea v-model="eventMemo" placeholder="予算やルールなど" class="input textarea"></textarea>
        </div>

        <div class="field">
          <label class="field__label">イベントのジャンル</label>
          <div class="genre-grid">
            <button
              v-for="g in genres" :key="g"
              class="genre" :class="{ 'is-active': selectedIcon === g }"
              @click="selectedIcon = g"
            >
              <span class="genre__icon"><GenreIcon :type="g" /></span>
              <span class="genre__label">{{ g }}</span>
            </button>
          </div>
        </div>

        <div class="field">
          <label class="field__label">招待コード</label>
          <p class="field__hint">友人に共有してメンバーを増やせます</p>
          <div class="invite">
            <span class="invite__code">{{ invitationCode }}</span>
            <button class="invite__copy" @click="copyToClipboard">コピー</button>
          </div>
        </div>

        <div class="actions">
          <button class="btn-brand" :disabled="loading" @click="createEvent">
            {{ loading ? '作成中…' : '作成する' }}
          </button>
        </div>
      </div>

      <div v-else>
        <div class="field">
          <label class="field__label">招待コードを入力</label>
          <input v-model="joinCode" type="text" placeholder="例：A1B2C3" class="input input--code" maxlength="6" />
        </div>
        <div class="actions">
          <button class="btn-brand" @click="joinEvent">参加する</button>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <BaseModal
        :show="modalState.show"
        :type="modalState.type"
        :title="modalState.title"
        :message="modalState.message"
        :showCancel="modalState.showCancel"
        :confirmText="modalState.confirmText"
        :cancelText="modalState.cancelText"
        @confirm="handleConfirmModal"
        @cancel="modalState.show = false"
        @close="modalState.show = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import BaseModal from '@/components/BaseModal.vue';
import PageHeader from '@/components/PageHeader.vue';
import GenreIcon from '@/components/GenreIcon.vue';

const router = useRouter();
const isJoinMode = ref(false);
const eventName = ref('');
const eventMemo = ref('');
const selectedIcon = ref('食事');
const joinCode = ref('');
const loading = ref(false);

const invitationCode = ref(Math.random().toString(36).substring(2, 8).toUpperCase());

const genres = ['食事', '旅行', '遊び', '買い物', '飲み会', 'その他'];

const modalState = reactive({
  show: false, type: 'info', title: '', message: '',
  showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null
});
const showModal = (options) => {
  Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, ...options, show: true });
};
const handleConfirmModal = () => {
  if (modalState.onConfirm) modalState.onConfirm();
  modalState.show = false;
};

const copyToClipboard = () => {
  navigator.clipboard.writeText(invitationCode.value)
    .then(() => {
      showModal({ type: 'success', title: 'コピー完了', message: '招待コードをクリップボードにコピーしました！' });
    })
    .catch(() => {
      showModal({ type: 'error', title: 'エラー', message: 'コピーに失敗しました' });
    });
};

const createEvent = async () => {
  if (!eventName.value) {
    showModal({ type: 'error', title: '入力エラー', message: 'イベント名を入力してください' });
    return;
  }

  loading.value = true;
  try {
    const myUid = auth.currentUser?.uid;
    if (!myUid) {
      showModal({ type: 'error', title: 'エラー', message: 'ログイン状態が確認できません。' });
      return;
    }

    const docRef = await addDoc(collection(db, "events"), {
      name: eventName.value,
      memo: eventMemo.value,
      tag: selectedIcon.value,
      invitationCode: invitationCode.value,
      participants: [myUid],
      totalAmount: 0,
      createdAt: serverTimestamp()
    });

    console.log('✅ Firestoreに直接保存完了:', docRef.id);
    router.push('/');
  } catch (error) {
    console.error('❌ 作成失敗:', error);
    showModal({ type: 'error', title: 'エラー', message: 'イベントの作成に失敗しました。電波状況を確認してください。' });
  } finally {
    loading.value = false;
  }
};

const joinEvent = async () => {
  const code = joinCode.value.trim().toUpperCase();
  if (!code) {
    showModal({ type: 'error', title: '入力エラー', message: '招待コードを入力してください' });
    return;
  }
  const myUid = auth.currentUser?.uid;
  if (!myUid) {
    showModal({ type: 'error', title: 'エラー', message: 'ログイン状態が確認できません。' });
    return;
  }
  try {
    const snap = await getDocs(query(collection(db, "events"), where("invitationCode", "==", code)));
    if (snap.empty) {
      showModal({ type: 'error', title: '見つかりません', message: 'その招待コードのイベントが見つかりませんでした。' });
      return;
    }
    const evDoc = snap.docs[0];
    const data = evDoc.data();
    if ((data.participants || []).includes(myUid)) {
      showModal({ type: 'info', title: '参加済み', message: 'すでにこのイベントに参加しています。', onConfirm: () => router.push(`/event/${evDoc.id}`) });
      return;
    }
    await updateDoc(doc(db, "events", evDoc.id), { participants: arrayUnion(myUid) });
    // 既存メンバーへ「参加しました」お知らせ
    let myName = auth.currentUser?.displayName || 'メンバー';
    try { const md = await getDoc(doc(db, "users", myUid)); if (md.exists() && md.data().name) myName = md.data().name; } catch (e) {}
    for (const uid of (data.participants || [])) {
      if (uid === myUid) continue;
      try {
        await addDoc(collection(db, "notifications"), {
          toUserId: uid, type: 'event_joined',
          eventId: evDoc.id, eventName: data.name || '',
          fromUserId: myUid, fromUserName: myName,
          isRead: false, createdAt: serverTimestamp(),
        });
      } catch (e) {}
    }
    showModal({ type: 'success', title: '参加完了', message: `「${data.name}」に参加しました！`, onConfirm: () => router.push(`/event/${evDoc.id}`) });
  } catch (e) {
    console.error("参加エラー:", e);
    showModal({ type: 'error', title: 'エラー', message: '参加に失敗しました。電波状況を確認してください。' });
  }
};

watch(isJoinMode, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style scoped>
.body { padding: 8px var(--pad) 28px; }

.mode-seg { margin-bottom: 20px; }

.field { margin-bottom: 22px; }
.field__label {
  display: block;
  font-size: 13px;
  font-weight: var(--fw-bold);
  color: var(--c-text-sub);
  margin-bottom: 8px;
}
.field__hint {
  font-size: 11px;
  font-weight: var(--fw-medium);
  color: var(--c-text-faint);
  margin: -4px 0 8px;
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
.textarea { height: 104px; resize: none; line-height: 1.6; }
.input--code {
  text-align: center;
  font-size: 24px;
  font-weight: var(--fw-black);
  letter-spacing: 8px;
}

/* ジャンル選択 */
.genre-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.genre {
  background: var(--c-surface);
  border: 1.5px solid var(--c-line-bold);
  border-radius: var(--r-md);
  padding: 16px 6px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--c-text-sub);
  transition: all 0.15s ease;
}
.genre__icon { width: 26px; height: 26px; color: var(--c-text-sub); }
.genre__label { font-size: 12px; font-weight: var(--fw-bold); }
.genre.is-active {
  border-color: var(--c-brand);
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
}
.genre.is-active .genre__icon { color: var(--c-brand); }

/* 招待コード */
.invite {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-md);
  padding: 12px 14px;
}
.invite__code {
  color: var(--c-brand-strong);
  font-weight: var(--fw-black);
  font-size: 22px;
  letter-spacing: 5px;
}
.invite__copy {
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
  padding: 8px 14px;
  border-radius: var(--r-sm);
  font-size: 12px;
  font-weight: var(--fw-bold);
}
.invite__copy:active { transform: scale(0.96); }

/* アクション */
.actions {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.btn-text {
  width: 100%;
  color: var(--c-text-sub);
  font-size: 14px;
  font-weight: var(--fw-bold);
  padding: 12px;
}
.btn-text:active { opacity: 0.6; }
</style>
