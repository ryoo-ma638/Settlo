<template>
  <div class="make-event-container">
    <h2 class="page-title">{{ isJoinMode ? 'イベントに参加する' : '新規イベント作成' }}</h2>

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
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/services/api'; // 🌟 パスに注意

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

const copyToClipboard = () => {
  navigator.clipboard.writeText(invitationCode.value);
  alert('コピーしました！');
};

// 🌟 連結されたイベント作成処理
const createEvent = async () => {
  if (!eventName.value) return alert('名前を入力してください');
  
  loading.value = true;
  try {
    // 1. Prisma側にユーザーがいない可能性を考慮して同期
    await api.post('/users/sync');

    // 2. イベントを作成
    const response = await api.post('/events', {
      name: eventName.value,
      memo: eventMemo.value,
      tag: selectedIcon.value,
      invitationCode: invitationCode.value
    });

    console.log('✅ サーバーに保存完了:', response.data);
    router.push('/'); 
  } catch (error) {
    console.error('❌ 作成失敗:', error);
    alert('作成に失敗しました。');
  } finally {
    loading.value = false;
  }
};

const joinEvent = async () => {
  // 参加ロジック（サーバー側の実装に合わせて調整）
  alert('現在、参加機能は調整中です。');
};

watch(isJoinMode, () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
</script>

<style scoped>
.make-event-container { 
  padding: 20px 25px; 
  background-color: #f8fafc; 
  min-height: 100vh; 
  box-sizing: border-box;

  /* 🌟 全体の開始位置を下げる（ヘッダー被り防止） */
  /* ヘッダーの高さが 60px なら 80px 程度が理想的です */
  padding-top: 80px; 
}

/* 🌟 .join-mode の padding-top は削除するか、containerと合わせる */
.join-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* 💻 PC版の調整 */
@media (min-width: 1024px) {
  .make-event-container {
    padding-top: 40px; /* PC版サイドバー利用時は余白を詰める */
  }
}
.page-title { font-size: 20px; font-weight: bold; margin-bottom: 30px; text-align: center; color: #1e293b; }
.input-section { margin-bottom: 25px; }
.input-label { display: block; font-weight: bold; font-size: 13px; margin-bottom: 8px; color: #64748b; }
.shadow-box { background-color: #f1f5f9; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 15px; width: 100%; box-sizing: border-box; font-size: 16px; transition: 0.2s; }
.shadow-box:focus { border-color: #3b82f6; background: white; outline: none; }
.textarea-field { height: 100px; resize: none; }
.icon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.icon-item { background-color: #f1f5f9; border: 1.5px solid transparent; border-radius: 12px; padding: 12px 5px; text-align: center; cursor: pointer; transition: 0.2s; }
.icon-item .emoji { font-size: 20px; }
.icon-item.active { background-color: #eff6ff; border-color: #3b82f6; color: #1e40af; }
.copy-box { display: flex; justify-content: space-between; align-items: center; background-color: #fff !important; }
.code { color: #3b82f6; font-weight: bold; font-size: 20px; font-family: monospace; letter-spacing: 2px; }
.copy-btn { color: #3b82f6; font-size: 12px; font-weight: bold; cursor: pointer; }
.main-btn { width: 100%; padding: 16px; border-radius: 16px; border: none; font-size: 16px; font-weight: bold; color: white; margin-bottom: 15px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
.create { background-color: #3b82f6; }
.create:disabled { opacity: 0.6; }
.sub-btn { width: 100%; background: none; border: none; color: #64748b; font-size: 14px; font-weight: bold; cursor: pointer; }
</style>