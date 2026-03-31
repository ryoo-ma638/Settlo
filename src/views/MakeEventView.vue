<template>
  <div class="make-event-container">
    <header class="detail-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1 class="title">{{ isJoinMode ? 'イベントに参加する' : '新規イベント作成' }}</h1>
      <div class="spacer"></div>
    </header>

    <main class="content">
      <div v-if="!isJoinMode">
        <div class="input-section">
          <label class="input-label">イベント名</label>
          <input v-model="eventName" type="text" placeholder="例：キャンプ、飲み会" class="input-field shadow-box" />
        </div>

        <div class="input-section">
          <label class="input-label">メモ</label>
          <textarea v-model="eventMemo" placeholder="予算やルールなど" class="textarea-field shadow-box"></textarea>
        </div>

        <div class="input-section">
          <label class="input-label">イベントのジャンル</label>
          <div class="icon-grid">
            <div 
              v-for="icon in icons" :key="icon.label"
              class="icon-item" :class="{ active: selectedIcon === icon.label }"
              @click="selectedIcon = icon.label"
            >
              <span class="emoji">{{ icon.emoji }}</span><br>{{ icon.label }}
            </div>
          </div>
        </div>

        <div class="input-section">
          <label class="input-label">招待コード</label>
          <p class="sub-text">友人に共有してメンバーを増やせます</p>
          <div class="copy-box shadow-box">
            <span class="code">{{ invitationCode }}</span>
            <span class="copy-btn" @click="copyToClipboard">コピー</span>
          </div>
        </div>

        <div class="action-buttons">
          <button class="main-btn create" :disabled="loading" @click="createEvent">
            {{ loading ? '作成中...' : '作成する' }}
          </button>
          <button class="sub-btn" @click="isJoinMode = true">既存のイベントに参加する</button>
        </div>
      </div>

      <div v-else class="join-mode">
        <div class="input-section">
          <label class="input-label">招待コードを入力</label>
          <input v-model="joinCode" type="text" placeholder="例：A1B2C3" class="input-field shadow-box join-input" maxlength="6" />
        </div>
        <div class="action-buttons">
          <button class="main-btn join" @click="joinEvent">参加する</button>
          <button class="sub-btn" @click="isJoinMode = false">新しくイベントを作る</button>
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
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; 
import BaseModal from '@/components/BaseModal.vue';

const router = useRouter();
const isJoinMode = ref(false);
const eventName = ref('');
const eventMemo = ref('');
const selectedIcon = ref('食事');
const joinCode = ref('');
const loading = ref(false);

const invitationCode = ref(Math.random().toString(36).substring(2, 8).toUpperCase());

const icons = [
  { label: '食事', emoji: '🍴' }, { label: '旅行', emoji: '✈️' },
  { label: '遊び', emoji: '🎡' }, { label: '買い物', emoji: '🛒' },
  { label: '飲み会', emoji: '🍺' }, { label: 'その他', emoji: '✨' }
];

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

    // 🌟 API (404) を使わず、直接Firestoreに保存する最強の回避策！
    const docRef = await addDoc(collection(db, "events"), {
      name: eventName.value,
      memo: eventMemo.value,
      tag: selectedIcon.value,
      invitationCode: invitationCode.value,
      participants: [myUid], // 作成者（自分）を参加者に追加
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
  showModal({ type: 'info', title: 'お知らせ', message: '現在、イベント参加機能は準備中です。' });
};

watch(isJoinMode, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style scoped>
.event-page-container { min-height: 100vh; background-color: #f0f4f8; padding-bottom: 80px; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10; }
.page-title { font-size: 20px; font-weight: bold; margin: 0; color: #1e293b; }
.check-settle-btn { background-color: #2169a3; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 6px rgba(33,105,163,0.3); transition: 0.2s; }
.check-settle-btn:active { transform: scale(0.95); }
/* ヘッダーデザイン: フレッシュなシアン系グラデーション */
.detail-header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 16px 20px; 
  background: linear-gradient(135deg, #cffafe 0%, #bae6fd 100%); 
  position: sticky; top: 60px; z-index: 100; 
  border-radius: 0 0 24px 24px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
  margin-bottom: 15px;
}
.back-btn { background: none; border: none; font-size: 32px; color: #0f172a; cursor: pointer; padding: 0; display: flex; align-items: center; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.title { font-size: 18px; font-weight: 900; margin: 0; color: #0f172a; flex: 1; text-align: center; }
.spacer { display: block; width: 32px; }

.content { 
  flex: 1; 
  padding: 15px 25px 100px; 
  width: 100%; 
  max-width: 600px; 
  margin: 0 auto; 
  box-sizing: border-box; 
}

.join-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.input-section { margin-bottom: 25px; }
.input-label { display: block; font-weight: 800; font-size: 13px; margin-bottom: 8px; color: #64748b; }
.shadow-box { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; width: 100%; box-sizing: border-box; font-size: 15px; font-weight: 800; color: #1e293b; transition: 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
.shadow-box:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.shadow-box::placeholder { color: #cbd5e1; font-weight: normal; }

.textarea-field { height: 100px; resize: none; }
.icon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.icon-item { background-color: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 14px 5px; text-align: center; cursor: pointer; transition: 0.2s; font-weight: 800; font-size: 12px; color: #64748b; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
.icon-item .emoji { font-size: 24px; margin-bottom: 4px; display: inline-block; }
.icon-item.active { background-color: #eff6ff; border-color: #3b82f6; color: #1e40af; }

.sub-text { font-size: 11px; font-weight: 700; color: #94a3b8; margin: -4px 0 8px 0; }
.copy-box { display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc !important; }
.code { color: #3b82f6; font-weight: 900; font-size: 24px; font-family: monospace; letter-spacing: 4px; }
.copy-btn { background: white; color: #3b82f6; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 900; cursor: pointer; border: 1px solid #cbd5e1; transition: 0.2s; }
.copy-btn:active { transform: scale(0.95); background: #f1f5f9; }

.main-btn { width: 100%; padding: 18px; border-radius: 20px; border: none; font-size: 16px; font-weight: 900; color: white; margin-bottom: 15px; cursor: pointer; box-shadow: 0 8px 20px rgba(59,130,246,0.25); transition: 0.2s; }
.main-btn:active { transform: scale(0.96); }
.create { background-color: #3b82f6; }
.create:disabled { opacity: 0.6; cursor: not-allowed; }
.join { background-color: #10b981; box-shadow: 0 8px 20px rgba(16,185,129,0.25); }
.sub-btn { width: 100%; background: none; border: none; color: #64748b; font-size: 14px; font-weight: 800; cursor: pointer; padding: 10px; transition: 0.2s; }
.sub-btn:active { opacity: 0.7; }
</style>