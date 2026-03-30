<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h2 class="modal-title">新しく支払いを追加</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body scroll-area">
          
          <div class="upload-section">
            <input type="file" ref="fileInput" class="hidden-input" accept="image/*" @change="handleFileUpload">
            <div 
              class="drop-zone" 
              :class="{ 'is-dragover': isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
              @click="$refs.fileInput.click()"
            >
              <div v-if="!uploadedImage" class="upload-placeholder">
                <span class="camera-icon">📷</span>
                <p class="upload-title">レシートを撮影・選択</p>
                <p class="upload-hint">または画像をドラッグ＆ドロップ<br>※自動で商品や金額を読み取ります</p>
              </div>
              <div v-else class="upload-preview">
                <img :src="uploadedImage" alt="レシート画像" class="preview-img">
                <button class="re-upload-btn" @click.stop="uploadedImage = null">✕ やり直す</button>
              </div>
            </div>
          </div>

          <div class="basic-info-card">
            <div class="input-row amount-row">
              <label>合計金額</label>
              <div class="amount-input-wrapper">
                <span class="currency-mark">¥</span>
                <input v-model="formData.amount" type="tel" class="amount-input" placeholder="0">
                <span class="currency-unit">円</span>
              </div>
            </div>

            <div class="input-row">
              <label>店名・内容</label>
              <input v-model="formData.itemName" type="text" class="standard-input" placeholder="例: 鳥貴族">
            </div>

            <div class="input-row half-row">
              <div class="half">
                <label>日付</label>
                <input v-model="formData.date" type="date" class="standard-input">
              </div>
              <div class="half">
                <label>立替えた人</label>
                <select v-model="formData.payer" class="standard-input select-style">
                  <option value="大崎 稜馬">自分</option>
                  <option value="小野木 涼平">小野木 涼平</option>
                  <option value="天野 椋祐">天野 椋祐</option>
                </select>
              </div>
            </div>
            <p v-if="formData.payer !== '大崎 稜馬'" class="payer-hint">
              💡 {{ formData.payer }} さんへの「支払い」として登録されます。
            </p>
          </div>

          <div class="split-type-section">
            <h3 class="section-sub-title">割り勘の方法</h3>
            <div class="ios-segmented-control">
              <button :class="{ active: formData.splitType === 'all' }" @click="formData.splitType = 'all'">全員で均等</button>
              <button :class="{ active: formData.splitType === 'custom' }" @click="formData.splitType = 'custom'">金額を指定</button>
              <button :class="{ active: formData.splitType === 'item' }" @click="formData.splitType = 'item'">商品ごとに指定</button>
            </div>
          </div>

          <div v-if="formData.splitType === 'all'" class="dynamic-section slide-in">
            <div class="split-result-box">
              <span class="split-desc">参加者全員で均等に割り勘します。</span>
              <h2 class="split-calc-amount">1人あたり ¥{{ calculatedSplitAmount }} 円</h2>
            </div>
          </div>

          <div v-if="formData.splitType === 'custom'" class="dynamic-section slide-in">
            <p class="section-desc">誰がいくら払うかを入力してください。</p>
            <div class="custom-split-list">
              <div class="custom-item" v-for="p in participants" :key="p.name">
                <div class="user-info">
                  <div class="avatar-small" :style="{ backgroundColor: p.color }"></div>
                  <span>{{ p.name }}</span>
                </div>
                <div class="custom-input-box">
                  <span>¥</span>
                  <input type="tel" placeholder="0">
                  <span>円</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="formData.splitType === 'item'" class="dynamic-section slide-in">
            <div class="item-split-header">
              <p class="section-desc">商品ごとに支払う人を選べます。（複数人選ぶとその商品代を割り勘）</p>
              <button class="add-item-btn" @click="addDummyItem">＋ 商品追加</button>
            </div>

            <div class="receipt-items-list">
              <div class="receipt-item-card" v-for="(item, index) in receiptItems" :key="index">
                <div class="item-header">
                  <input v-model="item.name" class="item-name-input" placeholder="商品名">
                  <div class="item-price-box">
                    <span>¥</span><input v-model="item.price" type="tel" class="item-price-input">
                  </div>
                  <button class="remove-item-btn" @click="receiptItems.splice(index, 1)">✕</button>
                </div>
                
                <div class="item-assignees">
                  <span class="assign-label">支払う人:</span>
                  <div class="assign-chips">
                    <button 
                      v-for="p in participants" :key="p.name"
                      class="chip"
                      :class="{ 'selected': item.assignees.includes(p.name) }"
                      @click="toggleAssignee(item, p.name)"
                    >
                      {{ p.name.split(' ')[0] }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <button class="submit-btn" @click="handleSubmit">この内容で追加する</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close', 'submit']);

// --- 状態管理 ---
const fileInput = ref(null);
const isDragging = ref(false);
const uploadedImage = ref(null);

const formData = ref({
  amount: '',
  itemName: '',
  date: new Date().toISOString().split('T')[0],
  payer: '大崎 稜馬',
  splitType: 'all' // 'all', 'custom', 'item'
});

// イベント参加者（ダミー）
const participants = [
  { name: '大崎 稜馬', color: '#fca5a5' },
  { name: '小野木 涼平', color: '#93c5fd' },
  { name: '天野 椋祐', color: '#86efac' },
];

// 商品ごとのリスト（レシート読み取りで自動入力される想定のダミー）
const receiptItems = ref([
  { name: '生ビール', price: 1200, assignees: ['大崎 稜馬', '小野木 涼平'] },
  { name: 'レモンサワー', price: 450, assignees: ['天野 椋祐'] },
]);

// --- 計算ロジック ---
const calculatedSplitAmount = computed(() => {
  const amt = Number(formData.value.amount);
  if (!amt || isNaN(amt)) return 0;
  return Math.floor(amt / participants.length).toLocaleString();
});

// --- アクション ---
const closeModal = () => emit('close');

const handleSubmit = () => {
  if (!formData.value.amount || !formData.value.itemName) {
    alert('合計金額と店名・内容は必須です！');
    return;
  }
  
  const payload = {
    payer: formData.value.payer,
    itemName: formData.value.itemName,
    splitType: formData.value.splitType === 'all' ? '全員で均等' : (formData.value.splitType === 'item' ? '商品ごとに指定' : '個別指定'),
    amount: Number(formData.value.amount),
    date: formData.value.date.replace(/-/g, '/')
  };

  emit('submit', payload);
  
  // 初期化
  formData.value.amount = '';
  formData.value.itemName = '';
  uploadedImage.value = null;
};

// --- レシート画像処理のモック ---
const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (file) createPreview(file);
};
const handleDrop = (e) => {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) createPreview(file);
};
const createPreview = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage.value = e.target.result;
    // モック: 画像読み込み時に自動入力された感を出す
    setTimeout(() => {
      formData.value.itemName = '鳥貴族 名古屋店';
      formData.value.amount = '4500';
    }, 800);
  };
  reader.readAsDataURL(file);
};

// --- 商品ごとの処理 ---
const toggleAssignee = (item, name) => {
  const idx = item.assignees.indexOf(name);
  if (idx > -1) item.assignees.splice(idx, 1);
  else item.assignees.push(name);
};
const addDummyItem = () => {
  receiptItems.value.push({ name: '', price: null, assignees: [] });
};
</script>

<style scoped>
/* 🌟 モーダル全体のベース */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
.modal-content { background: #f4f7f9; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; display: flex; flex-direction: column; max-height: 90vh; }

.modal-header { padding: 24px 24px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); background: white; border-radius: 32px 32px 0 0; }
.modal-title { margin: 0; font-size: 18px; color: #0f172a; font-weight: 900; }
.close-btn { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; color: #64748b; cursor: pointer; font-weight: bold; }

.scroll-area { overflow-y: auto; padding: 20px 24px; flex: 1; }

/* 🌟 1. レシート読み取りエリア */
.upload-section { margin-bottom: 24px; }
.hidden-input { display: none; }
.drop-zone { border: 2px dashed #cbd5e1; border-radius: 20px; background: white; padding: 20px; text-align: center; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden; min-height: 120px; display: flex; align-items: center; justify-content: center; }
.drop-zone:active { background: #f8fafc; transform: scale(0.98); }
.drop-zone.is-dragover { border-color: #3b82f6; background: #eff6ff; }
.camera-icon { font-size: 32px; display: block; margin-bottom: 8px; }
.upload-title { font-size: 15px; font-weight: 800; color: #3b82f6; margin: 0 0 4px 0; }
.upload-hint { font-size: 11px; color: #94a3b8; font-weight: 700; margin: 0; line-height: 1.4; }
.upload-preview { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.preview-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.6; }
.re-upload-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(15,23,42,0.8); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; backdrop-filter: blur(4px); }

/* 🌟 2. 基本情報のカード */
.basic-info-card { background: white; border-radius: 24px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; }
.input-row label { display: block; font-size: 12px; font-weight: 800; color: #64748b; margin-bottom: 6px; }
.half-row { display: flex; gap: 12px; }
.half { flex: 1; }

/* 金額入力（¥ と 円） */
.amount-input-wrapper { display: flex; align-items: baseline; gap: 4px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; transition: 0.2s; }
.amount-input-wrapper:focus-within { border-color: #f59e0b; }
.currency-mark { font-size: 24px; font-weight: 900; color: #1e293b; }
.amount-input { flex: 1; border: none; outline: none; font-size: 36px; font-weight: 900; color: #f59e0b; background: transparent; letter-spacing: -1px; width: 100%; }
.amount-input::placeholder { color: #cbd5e1; }
.currency-unit { font-size: 16px; font-weight: 800; color: #64748b; }

/* 標準入力UI */
.standard-input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; font-weight: 800; color: #1e293b; outline: none; box-sizing: border-box; transition: 0.2s; }
.standard-input:focus { border-color: #3b82f6; background: white; }
.select-style { appearance: none; cursor: pointer; }
.payer-hint { font-size: 11px; color: #059669; background: #ecfdf5; padding: 8px 12px; border-radius: 10px; margin: 0; font-weight: 700; }

/* 🌟 3. 割り勘タイプ選択 */
.split-type-section { margin-bottom: 16px; }
.section-sub-title { font-size: 14px; font-weight: 900; color: #0f172a; margin: 0 0 10px 0; }
.ios-segmented-control { display: flex; background: #e2e8f0; border-radius: 12px; padding: 4px; }
.ios-segmented-control button { flex: 1; padding: 10px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: #64748b; border-radius: 10px; cursor: pointer; transition: 0.2s; }
.ios-segmented-control button.active { background: white; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

/* 🌟 4. 動的セクション */
.dynamic-section { margin-bottom: 24px; }
.section-desc { font-size: 12px; color: #64748b; font-weight: 700; margin: 0 0 12px 0; }

/* ① 全員で均等 */
.split-result-box { background: white; border: 2px solid #3b82f6; border-radius: 20px; padding: 20px; text-align: center; }
.split-desc { font-size: 12px; color: #3b82f6; font-weight: 800; }
.split-calc-amount { font-size: 28px; font-weight: 900; color: #1e293b; margin: 8px 0 0 0; }

/* ② 個別指定 */
.custom-split-list { background: white; border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.custom-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px dashed #e2e8f0; }
.custom-item:last-child { border-bottom: none; }
.user-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: #1e293b; }
.avatar-small { width: 28px; height: 28px; border-radius: 50%; }
.custom-input-box { display: flex; align-items: baseline; gap: 4px; font-size: 14px; font-weight: 800; color: #64748b; }
.custom-input-box input { width: 80px; text-align: right; font-size: 18px; font-weight: 900; border: none; border-bottom: 2px solid #e2e8f0; outline: none; color: #f59e0b; padding-bottom: 2px; }

/* ③ 商品ごとに指定（新機能） */
.item-split-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
.add-item-btn { background: #eff6ff; color: #3b82f6; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
.receipt-items-list { display: flex; flex-direction: column; gap: 12px; }
.receipt-item-card { background: white; border-radius: 20px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
.item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.item-name-input { flex: 1; border: none; border-bottom: 2px solid #e2e8f0; font-size: 15px; font-weight: 900; color: #1e293b; padding-bottom: 4px; outline: none; }
.item-price-box { display: flex; align-items: baseline; gap: 2px; font-weight: 800; color: #64748b; }
.item-price-input { width: 60px; text-align: right; border: none; border-bottom: 2px solid #e2e8f0; font-size: 16px; font-weight: 900; color: #f59e0b; outline: none; }
.remove-item-btn { background: #f1f5f9; color: #94a3b8; border: none; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; font-weight: bold; cursor: pointer; }

.item-assignees { background: #f8fafc; padding: 12px; border-radius: 12px; }
.assign-label { font-size: 11px; color: #64748b; font-weight: 800; display: block; margin-bottom: 8px; }
.assign-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { background: white; border: 1px solid #cbd5e1; color: #64748b; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.chip.selected { background: #3b82f6; border-color: #3b82f6; color: white; box-shadow: 0 2px 6px rgba(59,130,246,0.3); }

/* 🌟 フッター（固定） */
.modal-footer { padding: 16px 24px 30px; background: white; border-top: 1px solid rgba(0,0,0,0.05); }
.submit-btn { width: 100%; background-color: #0f172a; color: white; border: none; padding: 18px; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,0.15); transition: 0.2s; }
.submit-btn:active { transform: scale(0.96); }

.slide-in { animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>