<template>
  <div class="make-event-container">
    <h2 class="page-title">{{ isJoinMode ? 'イベントに参加する' : '新規イベント作成' }}</h2>

    <div v-if="!isJoinMode">
      <div class="input-section">
        <label class="input-label">イベント詳細</label>
        <input v-model="eventName" type="text" placeholder="例：旅行" class="input-field shadow-box" />
      </div>

      <div class="input-section">
        <label class="input-label">メモ</label>
        <textarea v-model="eventMemo" placeholder="目的、ルールなど" class="textarea-field shadow-box"></textarea>
      </div>

      <div class="input-section">
        <label class="input-label">イベントアイコン</label>
        <div class="icon-grid">
          <div 
            v-for="icon in icons" :key="icon.label"
            class="icon-item" :class="{ active: selectedIcon === icon.label }"
            @click="selectedIcon = icon.label"
          >
            <span v-html="icon.emoji"></span><br>{{ icon.label }}
          </div>
        </div>
      </div>

      <div class="input-section">
        <label class="input-label">招待コード</label>
        <p class="sub-text">このコードを友人に共有して参加してもらいましょう</p>
        <div class="copy-box shadow-box">
          <span class="code">{{ invitationCode }}</span>
          <span class="copy-btn" @click="copyToClipboard">■ コピー</span>
        </div>
      </div>
    </div>

    <div v-else class="join-section">
      <div class="input-section">
        <label class="input-label">招待コードを入力してください</label>
        <p class="sub-text">友人から共有された6桁のコードを入力してください</p>
        <input 
          v-model="inputJoinCode" 
          type="text" 
          maxlength="6" 
          placeholder="例：ABC123" 
          class="input-field shadow-box join-input"
        />
      </div>
    </div>

    <div class="button-group">
      <button v-if="!isJoinMode" class="main-btn" @click="createEvent">イベントを作成する　→</button>
      <button v-else class="main-btn" @click="joinEvent">イベントに参加する　→</button>
      
      <button class="sub-btn" @click="isJoinMode = !isJoinMode">
        {{ isJoinMode ? '← イベント作成に戻る' : '既存のイベントに参加する　👤' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// モード管理（false:作成, true:参加）
const isJoinMode = ref(false);

// 作成用データ
const eventName = ref('');
const eventMemo = ref('');
const invitationCode = ref('');
const selectedIcon = ref('食事代');

// 参加用データ
const inputJoinCode = ref('');

const icons = [
  { emoji: '🍽️', label: '食事代' },
  { emoji: '🎮', label: '遊び代' },
  { emoji: '🚗', label: '交通費' },
  { emoji: '🛒', label: '？？購入代' },
  { emoji: '💼', label: '仕事' },
  { emoji: '✨', label: 'その他' }
];

// イベント作成処理
const createEvent = () => {
  if (!eventName.value) return alert('詳細を入力してください');
  const newEvent = {
    id: Date.now(),
    name: eventName.value,
    tag: selectedIcon.value,
    amount: '¥0',
    status: 'active'
  };
  const saved = JSON.parse(localStorage.getItem('settlo_events') || '[]');
  saved.unshift(newEvent);
  localStorage.setItem('settlo_events', JSON.stringify(saved));
  router.push('/');
};

// イベント参加処理（追加）
const joinEvent = () => {
  if (inputJoinCode.value.length !== 6) {
    alert('6桁のコードを正しく入力してください');
    return;
  }
  // ※本来はここでコードをサーバーに確認しに行きます
  alert('イベントに参加しました！');
  router.push('/');
};

// 招待コード生成
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  invitationCode.value = result;
};

// コピー機能
const copyToClipboard = () => {
  const text = invitationCode.value;
  if (!text) return;
  navigator.clipboard.writeText(text);
};

onMounted(() => {
  generateCode();
});
</script>

<style scoped>
.make-event-container { padding: 20px; background-color: #eef7ff; min-height: 100vh; padding-bottom: 100px; }
.page-title { color: #2169a3; font-size: 22px; font-weight: bold; margin-bottom: 20px; }
.input-section { margin-bottom: 20px; }
.input-label { display: block; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
.shadow-box { background-color: #dcdcdc; border: none; border-radius: 10px; padding: 12px; width: 100%; box-sizing: border-box; color: #333; }
.textarea-field { height: 100px; resize: none; }

/* 参加用入力欄の強調 */
.join-input {
  text-align: center;
  font-size: 24px;
  letter-spacing: 4px;
  text-transform: uppercase; /* 小文字で打っても大文字にする */
  background-color: #fff;
  border: 2px solid #2169a3;
}

.icon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.icon-item { background-color: #dcdcdc; border-radius: 10px; padding: 15px 5px; text-align: center; font-size: 12px; font-weight: bold; cursor: pointer; }
.icon-item.active { background-color: #2b78ba; color: white; }
.sub-text { font-size: 11px; color: #666; margin-bottom: 5px; }
.copy-box { display: flex; justify-content: space-between; align-items: center; background-color: #fff !important; }
.code { color: #2169a3; font-weight: bold; font-size: 20px; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; }
.copy-btn { color: #2169a3; font-size: 13px; font-weight: bold; cursor: pointer; padding: 5px 10px; border-left: 1px solid #eee; }

.button-group { margin-top: 30px; display: flex; flex-direction: column; gap: 12px; }
.main-btn { background-color: #2169a3; color: white; border: none; border-radius: 10px; padding: 15px; font-size: 16px; font-weight: bold; cursor: pointer; }
.sub-btn { background-color: #fff; color: #2169a3; border: 2px solid #2169a3; border-radius: 10px; padding: 12px; font-size: 16px; font-weight: bold; cursor: pointer; }
</style>