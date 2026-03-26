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
          <span class="copy-btn" @click="copyToClipboard">コピー</span>
        </div>
      </div>

      <div class="action-buttons">
        <button class="main-btn create" @click="createEvent">作成する</button>
        <button class="sub-btn" @click="isJoinMode = true">既存のイベントに参加する</button>
      </div>
    </div>

    <div v-else>
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

const router = useRouter();
const isJoinMode = ref(false);
const eventName = ref('');
const eventMemo = ref('');
const selectedIcon = ref('食事');
const joinCode = ref('');

// 招待コードを自動生成（6桁）
const invitationCode = ref(Math.random().toString(36).substring(2, 8).toUpperCase());

const icons = [
  { label: '食事', emoji: '🍴' },
  { label: '旅行', emoji: '✈️' },
  { label: '遊び', emoji: '🎡' },
  { label: '買い物', emoji: '🛒' },
  { label: '飲み会', emoji: '🍺' },
  { label: 'その他', emoji: '✨' }
];

const copyToClipboard = () => {
  navigator.clipboard.writeText(invitationCode.value);
  alert('コピーしました！');
};

const createEvent = () => {
  if (!eventName.value) return alert('詳細を入力してください');

  const newEvent = {
    id: Date.now(),
    name: eventName.value,
    memo: eventMemo.value,
    tag: selectedIcon.value,
    code: invitationCode.value, // 🌟 ここでしっかり保存
    amount: '¥0',
    status: 'active'
  };

  const saved = JSON.parse(localStorage.getItem('settlo_events') || '[]');
  saved.unshift(newEvent);
  localStorage.setItem('settlo_events', JSON.stringify(saved));
  
  router.push('/');
};

const joinEvent = () => {
  if (joinCode.value.length < 6) return alert('正しいコードを入力してください');
  alert('イベントに参加しました！');
  router.push('/');
};
</script>

<style scoped>
.make-event-container { padding: 20px 25px; background-color: #f0f4f8; min-height: 100vh; }
.page-title { font-size: 22px; font-weight: bold; margin-bottom: 25px; text-align: center; }
.input-section { margin-bottom: 25px; }
.input-label { display: block; font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #333; }
.shadow-box { background-color: #dcdcdc; border: none; border-radius: 12px; padding: 15px; width: 100%; box-sizing: border-box; font-size: 16px; }
.textarea-field { height: 100px; resize: none; }
.join-input { text-align: center; font-size: 24px; letter-spacing: 4px; text-transform: uppercase; background-color: #fff; border: 2px solid #2169a3; }
.icon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.icon-item { background-color: #dcdcdc; border-radius: 10px; padding: 15px 5px; text-align: center; font-size: 12px; font-weight: bold; cursor: pointer; }
.icon-item.active { background-color: #2b78ba; color: white; }
.sub-text { font-size: 11px; color: #666; margin-bottom: 5px; }
.copy-box { display: flex; justify-content: space-between; align-items: center; background-color: #fff !important; }
.code { color: #2169a3; font-weight: bold; font-size: 20px; font-family: monospace; letter-spacing: 2px; }
.copy-btn { color: #2169a3; font-size: 12px; font-weight: bold; text-decoration: underline; cursor: pointer; }
.action-buttons { margin-top: 40px; }
.main-btn { width: 100%; padding: 15px; border-radius: 12px; border: none; font-size: 18px; font-weight: bold; color: white; margin-bottom: 15px; cursor: pointer; }
.create { background-color: #2169a3; }
.join { background-color: #059669; }
.sub-btn { width: 100%; background: none; border: none; color: #2169a3; font-size: 14px; font-weight: bold; text-decoration: underline; cursor: pointer; }
</style>