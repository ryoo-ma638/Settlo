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
            <input type="file" ref="cameraInput" accept="image/*" capture="environment" class="hidden-input" @change="handleFileUpload">
            <input type="file" ref="fileInput" accept="image/*" class="hidden-input" @change="handleFileUpload">
            
            <div 
              class="drop-zone" 
              :class="{ 'is-dragover': isDragging, 'is-analyzing': isAnalyzing }"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <div v-if="!uploadedImage && !isAnalyzing" class="upload-placeholder">
                <p class="upload-hint">レシートを読み取って自動入力</p>
                <div class="upload-actions">
                  <button class="upload-action-btn" @click="$refs.cameraInput.click()">
                    <span class="icon">📸</span> カメラで撮影
                  </button>
                  <button class="upload-action-btn" @click="$refs.fileInput.click()">
                    <span class="icon">🖼️</span> アルバムから
                  </button>
                </div>
              </div>

              <div v-else-if="isAnalyzing" class="analyzing-view">
                <div class="scan-line"></div>
                <img :src="uploadedImage" class="scanning-img">
                <div class="analyzing-text">
                  <span class="spinner"></span> AIがレシートを解析中...
                </div>
              </div>

              <div v-else class="upload-preview">
                <img :src="uploadedImage" alt="レシート画像" class="preview-img">
                <div class="success-badge">✅ 読み取り完了</div>
                <button class="re-upload-btn" @click.stop="resetUpload">✕ やり直す</button>
              </div>
            </div>
          </div>

          <div class="basic-info-card">
            <div class="input-row amount-row">
              <label>合計金額</label>
              <div class="amount-input-wrapper">
                <span class="currency-mark">¥</span>
                <input v-model="formData.amount" type="tel" class="amount-input" placeholder="0" @change="calculateRemaining">
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
                <label>時間 <span class="hint-text">(任意)</span></label>
                <input v-model="formData.time" type="time" class="standard-input">
              </div>
            </div>

            <div class="input-row">
              <label>立替えた人</label>
              <select v-model="formData.payer" class="standard-input select-style">
                <option value="大崎 稜馬">自分</option>
                <option value="小野木 涼平">小野木 涼平</option>
                <option value="天野 椋祐">天野 椋祐</option>
              </select>
            </div>
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
            <div class="custom-split-header">
              <p class="section-desc">誰がいくら払うかを入力してください。</p>
              <span class="remaining-text" :class="{ 'error': remainingAmount < 0 }">
                残り: ¥{{ remainingAmount.toLocaleString() }}
              </span>
            </div>
            
            <div class="custom-split-list">
              <div class="custom-item" v-for="p in participants" :key="p.name">
                <div class="user-info">
                  <div class="avatar-small" :style="{ backgroundColor: p.color }"></div>
                  <span>{{ p.name }}</span>
                </div>
                <div class="custom-input-box">
                  <span>¥</span>
                  <input 
                    v-model="customSplitAmounts[p.name]" 
                    type="tel" 
                    placeholder="0"
                    @blur="calculateRemaining"
                  >
                  <span>円</span>
                </div>
              </div>
            </div>
            <p class="ai-hint">💡 最後の1人は、残りの金額が自動で入力されます！</p>
          </div>

          <div v-if="formData.splitType === 'item'" class="dynamic-section slide-in">
            <div class="item-split-header">
              <p class="section-desc">商品ごとに支払う人を選べます。</p>
              <button class="add-item-btn" @click="addDummyItem">＋ 商品追加</button>
            </div>

            <div class="receipt-items-list">
              <div v-if="receiptItems.length === 0" class="empty-items">レシートを読み取るとここに商品が並びます</div>
              
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
import { ref, computed } from 'vue';

// 🌟 ここを追加！Firebaseと通信するための準備
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase"; // ※firebase.jsの場所に合わせてパス("../firebase"など)は調整してください

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close', 'submit']);

// --- 状態管理 ---
const cameraInput = ref(null);
const fileInput = ref(null);
const isDragging = ref(false);
const uploadedImage = ref(null);
const isAnalyzing = ref(false);

const formData = ref({
  amount: '',
  itemName: '',
  date: new Date().toISOString().split('T')[0],
  time: '', 
  payer: '大崎 稜馬',
  splitType: 'all'
});

const participants = [
  { name: '大崎 稜馬', color: '#fca5a5' },
  { name: '小野木 涼平', color: '#93c5fd' },
  { name: '天野 椋祐', color: '#86efac' },
];

const receiptItems = ref([]);

const customSplitAmounts = ref({});
participants.forEach(p => {
  customSplitAmounts.value[p.name] = '';
});

// --- 計算ロジック ---
const calculatedSplitAmount = computed(() => {
  const amt = Number(formData.value.amount);
  if (!amt || isNaN(amt)) return 0;
  return Math.floor(amt / participants.length).toLocaleString();
});

const remainingAmount = computed(() => {
  const total = Number(formData.value.amount) || 0;
  let entered = 0;
  for (const name in customSplitAmounts.value) {
    const val = Number(customSplitAmounts.value[name]);
    if (!isNaN(val)) entered += val;
  }
  return total - entered;
});

const calculateRemaining = () => {
  const total = Number(formData.value.amount) || 0;
  let enteredTotal = 0;
  let emptyKeys = [];

  for (const name in customSplitAmounts.value) {
    const val = customSplitAmounts.value[name];
    if (val !== '' && val !== null && !isNaN(val)) {
      enteredTotal += Number(val);
    } else {
      emptyKeys.push(name);
    }
  }

  if (emptyKeys.length === 1) {
    const remaining = total - enteredTotal;
    customSplitAmounts.value[emptyKeys[0]] = remaining > 0 ? remaining : 0;
  }
};

// --- アクション ---
const closeModal = () => emit('close');

const handleSubmit = () => {
  if (!formData.value.amount || !formData.value.itemName) {
    alert('合計金額と店名・内容は必須です！');
    return;
  }
  
  const submitTime = formData.value.time || new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  const payload = {
    payer: formData.value.payer,
    itemName: formData.value.itemName,
    splitType: formData.value.splitType,
    amount: Number(formData.value.amount),
    date: formData.value.date.replace(/-/g, '/'),
    time: submitTime 
  };

  emit('submit', payload);
  resetUpload();
};

const resetUpload = () => {
  formData.value.amount = '';
  formData.value.itemName = '';
  formData.value.time = '';
  uploadedImage.value = null;
  isAnalyzing.value = false;
  receiptItems.value = [];
  participants.forEach(p => customSplitAmounts.value[p.name] = '');
};

// --- 🌟 本物のAIを呼び出す処理に書き換え！ ---
const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (file) processImage(file);
};
const handleDrop = (e) => {
  isDragging.value = false;
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) processImage(file);
};

const processImage = (file) => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    uploadedImage.value = e.target.result;
    isAnalyzing.value = true; // アニメーション開始
    
    try {
      // さっきデプロイしたFirebase Functions（本物のAI）を呼び出す
      const functions = getFunctions(app, 'asia-northeast1');
      const analyzeReceipt = httpsCallable(functions, 'analyzeReceipt');
      
      const result = await analyzeReceipt({ image: uploadedImage.value });
      const data = result.data; // AIが返してきたJSONデータ！

      // フォームに自動入力
      formData.value.itemName = data.storeName || '不明な店舗';
      formData.value.amount = data.totalAmount ? String(data.totalAmount) : '';
      if (data.date) formData.value.date = data.date;
      if (data.time) formData.value.time = data.time;
      
      // 商品リストの構築
      if (data.items && data.items.length > 0) {
        receiptItems.value = data.items.map(item => ({
          name: item.name || '不明な商品',
          price: item.price || 0,
          assignees: [] 
        }));
        formData.value.splitType = 'item'; // 商品タブに切り替え
      }

    } catch (error) {
      console.error("読み取りエラー:", error);
      alert("レシートの読み取りに失敗しました。手動で入力してください。");
    } finally {
      isAnalyzing.value = false; // アニメーション終了
    }
  };
  reader.readAsDataURL(file); // 画像をBase64に変換して読み込み
};

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

/* 🌟 1. レシート撮影・選択エリア */
.upload-section { margin-bottom: 24px; }
.hidden-input { display: none; }
.drop-zone { border: 2px dashed #cbd5e1; border-radius: 20px; background: white; padding: 20px; text-align: center; transition: 0.2s; position: relative; overflow: hidden; min-height: 140px; display: flex; align-items: center; justify-content: center; }
.drop-zone.is-dragover { border-color: #3b82f6; background: #eff6ff; }
.drop-zone.is-analyzing { border-color: #f59e0b; background: #fffbeb; }

.upload-placeholder { width: 100%; }
.upload-hint { font-size: 13px; font-weight: 800; color: #64748b; margin: 0 0 15px 0; }
.upload-actions { display: flex; gap: 10px; justify-content: center; }
.upload-action-btn { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 16px; font-size: 12px; font-weight: 900; color: #1e293b; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.upload-action-btn:active { transform: scale(0.96); background: #e2e8f0; }
.upload-action-btn .icon { font-size: 24px; }

/* AI解析中のアニメーション */
.analyzing-view { width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); z-index: 10; }
.scanning-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; position: absolute; top: 0; left: 0; }
.scan-line { position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: #3b82f6; box-shadow: 0 0 15px #3b82f6; animation: scan 1.5s infinite linear; z-index: 11; }
@keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
.analyzing-text { position: relative; z-index: 12; color: white; font-weight: 900; font-size: 14px; display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 8px 16px; border-radius: 20px; backdrop-filter: blur(4px); }
.spinner { width: 16px; height: 16px; border: 3px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s infinite linear; }
@keyframes spin { to { transform: rotate(360deg); } }

/* アップロード完了後 */
.upload-preview { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.preview-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.3; }
.success-badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -100%); background: #10b981; color: white; padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: 900; box-shadow: 0 4px 10px rgba(16,185,129,0.3); }
.re-upload-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, 20%); background: rgba(15,23,42,0.8); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; backdrop-filter: blur(4px); cursor: pointer; }

/* 🌟 2. 基本情報のカード */
.basic-info-card { background: white; border-radius: 24px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 24px; display: flex; flex-direction: column; gap: 16px; }
.input-row label { display: block; font-size: 12px; font-weight: 800; color: #64748b; margin-bottom: 6px; }
.hint-text { font-weight: normal; font-size: 10px; color: #94a3b8; } 
.half-row { display: flex; gap: 12px; }
.half { flex: 1; }

.amount-input-wrapper { display: flex; align-items: baseline; gap: 4px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; transition: 0.2s; }
.amount-input-wrapper:focus-within { border-color: #f59e0b; }
.currency-mark { font-size: 24px; font-weight: 900; color: #1e293b; }
.amount-input { flex: 1; border: none; outline: none; font-size: 36px; font-weight: 900; color: #f59e0b; background: transparent; letter-spacing: -1px; width: 100%; }
.amount-input::placeholder { color: #cbd5e1; }
.currency-unit { font-size: 16px; font-weight: 800; color: #64748b; }

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

.split-result-box { background: white; border: 2px solid #3b82f6; border-radius: 20px; padding: 20px; text-align: center; }
.split-desc { font-size: 12px; color: #3b82f6; font-weight: 800; }
.split-calc-amount { font-size: 28px; font-weight: 900; color: #1e293b; margin: 8px 0 0 0; }

/* カスタム（金額指定） */
.custom-split-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.remaining-text { font-size: 13px; font-weight: 900; color: #3b82f6; background: #eff6ff; padding: 4px 10px; border-radius: 12px; transition: 0.2s; }
.remaining-text.error { color: #ef4444; background: #fef2f2; }
.ai-hint { font-size: 11px; font-weight: 800; color: #10b981; text-align: center; margin-top: 12px; }

.custom-split-list { background: white; border-radius: 20px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.custom-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px dashed #e2e8f0; }
.custom-item:last-child { border-bottom: none; }
.user-info { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: #1e293b; }
.avatar-small { width: 28px; height: 28px; border-radius: 50%; }
.custom-input-box { display: flex; align-items: baseline; gap: 4px; font-size: 14px; font-weight: 800; color: #64748b; }
.custom-input-box input { width: 80px; text-align: right; font-size: 18px; font-weight: 900; border: none; border-bottom: 2px solid #e2e8f0; outline: none; color: #f59e0b; padding-bottom: 2px; }

/* 商品ごとに指定 */
.item-split-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; }
.add-item-btn { background: #eff6ff; color: #3b82f6; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
.receipt-items-list { display: flex; flex-direction: column; gap: 12px; }
.empty-items { background: white; padding: 30px; text-align: center; border-radius: 20px; border: 2px dashed #cbd5e1; font-size: 12px; font-weight: 800; color: #94a3b8; }
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