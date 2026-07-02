<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h2 class="modal-title">{{ editData ? '支払いを編集' : '新しく支払いを追加' }}</h2>
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
                    <svg class="upload-action-btn__icon" viewBox="0 0 24 24"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>
                    カメラで撮影
                  </button>
                  <button class="upload-action-btn" @click="$refs.fileInput.click()">
                    <svg class="upload-action-btn__icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/></svg>
                    アルバムから
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
                <div class="success-badge">読み取り完了</div>
                <button class="re-upload-btn" @click.stop="resetUpload">やり直す</button>
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

            <div class="input-row">
              <label>事業者登録番号 <span class="hint-text">(任意・レシートから自動取得)</span></label>
              <input v-model="formData.registrationNumber" type="text" class="standard-input" placeholder="例: T1234567890123">
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
                <option v-if="participants.length === 0" disabled value="">参加者がいません</option>
                <option v-for="p in participants" :key="p.id || p.name" :value="p.name">
                  {{ p.isMe ? p.name + '（自分）' : p.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="category-section">
            <h3 class="section-sub-title">ジャンル</h3>
            <div class="category-row">
              <button
                v-for="c in categories" :key="c" type="button"
                class="cat-chip" :class="{ active: formData.category === c }"
                @click="formData.category = c"
              >
                <span class="cat-icon"><GenreIcon :type="c" /></span>
                <span class="cat-label">{{ c }}</span>
              </button>
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
            <p class="ai-hint">最後の1人は、残りの金額が自動で入力されます</p>
          </div>

          <div v-if="formData.splitType === 'item'" class="dynamic-section slide-in">
            <div class="item-split-header">
              <div class="header-left">
                <p class="section-desc">商品ごとに支払う人を選べます。</p>
                <p class="match-status" :class="{'matched': itemsTotal === Number(formData.amount), 'error': itemsTotal !== Number(formData.amount)}">
                  内訳合計: ¥{{ itemsTotal.toLocaleString() }} / 全体: ¥{{ Number(formData.amount).toLocaleString() }}
                </p>
              </div>
              <button class="add-item-btn" @click="addDummyItem">＋ 商品追加</button>
            </div>

            <div class="global-tax-control">
              <span>一括設定:</span>
              <button class="global-tax-btn" @click="setGlobalTax(0)">すべて税抜</button>
              <button class="global-tax-btn" @click="setGlobalTax(8)">すべて+8%</button>
              <button class="global-tax-btn" @click="setGlobalTax(10)">すべて+10%</button>
            </div>

            <div class="receipt-items-list">
              <div v-if="receiptItems.length === 0" class="empty-items">レシートを読み取るとここに商品が並びます</div>
              
              <div class="receipt-item-card" v-for="(item, index) in receiptItems" :key="index">
                <div class="item-main-row">
                  <input v-model="item.name" class="item-name-input" placeholder="商品名">
                  <button class="remove-item-btn" @click="receiptItems.splice(index, 1)" aria-label="削除">
                    <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
                  </button>
                </div>
                
                <div class="item-math-row">
                  <div class="price-input-wrapper">
                    <span>¥</span><input v-model="item.price" type="tel" class="item-price-input" placeholder="単価">
                  </div>
                  <span class="math-sign">×</span>
                  <div class="qty-control">
                    <button @click="item.qty > 1 && item.qty--">-</button>
                    <span>{{ item.qty }}</span>
                    <button @click="item.qty++">+</button>
                  </div>
                  <button class="tax-toggle-btn" :class="'tax-' + item.taxRate" @click="toggleTax(item)">
                    {{ item.taxRate === 0 ? '税込' : `+${item.taxRate}%` }}
                  </button>
                </div>

                <div class="item-subtotal">
                  小計: <strong>¥{{ calcItemTotal(item).toLocaleString() }}</strong>
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
          <button class="submit-btn" @click="handleSubmit">{{ editData ? 'この内容で保存する' : 'この内容で追加する' }}</button>
        </div>

      </div>
    </div>

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
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import BaseModal from '../components/BaseModal.vue';
import GenreIcon from '../components/GenreIcon.vue'; // 🌟 支払いジャンルのアイコン
import { app } from "../firebase";
import { getFunctions, httpsCallable } from "firebase/functions"; // ← AI通信に必要なこれらが抜けていました！

// 🌟 支払いのジャンル候補
const categories = ['食事', 'カフェ', 'コンビニ', 'スーパー', '買い物', '交通', '旅行', '遊び', '飲み会', 'その他'];

// 🌟 統一モーダルの状態管理
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

// 🌟 実データ化：イベントの参加者（{ id, name, color/photo, isMe }）を親から受け取る
const props = defineProps({
  isOpen: Boolean,
  participants: { type: Array, default: () => [] },
  myName: { type: String, default: '' },
  myUid: { type: String, default: '' },
  editData: { type: Object, default: null }, // 🌟 編集対象（nullなら新規追加）
});
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
  payer: '',
  category: '食事', // 🌟 支払いジャンル
  splitType: 'all',
  registrationNumber: '' // 🌟 事業者登録番号（インボイス・レシートOCRで取得）
});

// 🌟 参加者は親（イベント）から渡された実データを使う
const participants = computed(() => props.participants || []);

const receiptItems = ref([]);

const customSplitAmounts = ref({});

// 🌟 参加者が変わるたびに、金額指定の入力欄と「立替えた人」の初期値を作り直す
watch(participants, (list) => {
  const arr = list || [];
  const next = {};
  arr.forEach(p => { next[p.name] = customSplitAmounts.value[p.name] ?? ''; });
  customSplitAmounts.value = next;
  // 立替えた人の初期値：自分 → 先頭参加者の順で決める
  if (!formData.value.payer || !arr.find(p => p.name === formData.value.payer)) {
    const me = arr.find(p => p.isMe);
    formData.value.payer = me ? me.name : (arr[0]?.name || props.myName || '');
  }
}, { immediate: true, deep: true });

// 🌟 フォームを新規状態にリセット
const resetForm = () => {
  formData.value.amount = '';
  formData.value.itemName = '';
  formData.value.date = new Date().toISOString().split('T')[0];
  formData.value.time = '';
  formData.value.category = '食事';
  formData.value.splitType = 'all';
  formData.value.registrationNumber = '';
  receiptItems.value = [];
  uploadedImage.value = null;
  isAnalyzing.value = false;
  const next = {};
  (props.participants || []).forEach(p => { next[p.name] = ''; });
  customSplitAmounts.value = next;
  const me = (props.participants || []).find(p => p.isMe);
  formData.value.payer = me ? me.name : (props.myName || (props.participants || [])[0]?.name || '');
};

// 🌟 編集対象の内容をフォームに流し込む
const prefillFromEdit = (d) => {
  formData.value.amount = String(d.amount ?? '');
  formData.value.itemName = d.itemName || '';
  formData.value.date = d.date ? String(d.date).replace(/\//g, '-') : new Date().toISOString().split('T')[0];
  formData.value.time = d.time || '';
  formData.value.category = d.category || 'その他';
  formData.value.splitType = d.splitType || 'all';
  formData.value.registrationNumber = d.registrationNumber || '';
  formData.value.payer = d.payer || '';
  const next = {};
  (props.participants || []).forEach(p => { next[p.name] = ''; });
  (d.shares || []).forEach(s => { if (s && s.name != null) next[s.name] = Number(s.amount) || ''; });
  customSplitAmounts.value = next;
  receiptItems.value = (d.items || []).map(it => ({
    name: it.name || '', price: it.price || 0, qty: 1, taxRate: 0, assignees: it.assignees || [],
  }));
  uploadedImage.value = null;
  isAnalyzing.value = false;
};

// 🌟 モーダルを開くたび、編集ならその内容を、新規なら初期状態に
watch(() => props.isOpen, (open) => {
  if (!open) return;
  if (props.editData) prefillFromEdit(props.editData);
  else resetForm();
});

// --- 計算ロジック ---
const calculatedSplitAmount = computed(() => {
  const amt = Number(formData.value.amount);
  const count = participants.value.length || 1;
  if (!amt || isNaN(amt)) return 0;
  return Math.floor(amt / count).toLocaleString();
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


const resetUpload = () => {
  formData.value.amount = '';
  formData.value.itemName = '';
  formData.value.time = '';
  uploadedImage.value = null;
  isAnalyzing.value = false;
  receiptItems.value = [];
  participants.value.forEach(p => customSplitAmounts.value[p.name] = '');
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
      // Firebase Functions（本物のAI）を呼び出す
      const functions = getFunctions(app, 'asia-northeast1');
      const analyzeReceipt = httpsCallable(functions, 'analyzeReceipt');
      
      const result = await analyzeReceipt({ image: uploadedImage.value });
      const data = result.data; // AIが返してきたJSONデータ！

      // フォームに自動入力
      formData.value.itemName = data.storeName || '不明な店舗';
      formData.value.amount = data.totalAmount ? String(data.totalAmount) : '';
      if (data.date) formData.value.date = data.date;
      if (data.time) formData.value.time = data.time;
      formData.value.registrationNumber = data.registrationNumber || ''; // 事業者登録番号
      
      // 🌟 ここが新しい処理！展開せずに「個数（qty）」と「税率（taxRate）」として綺麗にセットする
      if (data.items && data.items.length > 0) {
        receiptItems.value = data.items.map(item => ({
          name: item.name || '不明な商品',
          price: item.price || 0,
          qty: item.quantity && item.quantity > 0 ? item.quantity : 1, // AIが読んだ個数をセット
          taxRate: 0, // 初期値は税込(0%)
          assignees: [] 
        }));
        formData.value.splitType = 'item'; // 商品タブに自動で切り替え
      }
    } catch (error) {
      console.error("読み取りエラー:", error);
      showModal({ type: 'error', title: '読み取りエラー', message: 'レシートの読み取りに失敗しました。手動で入力してください。' });
    } finally {
      isAnalyzing.value = false; // ← アニメーションを止める処理が抜けていました！
    }
  };
  reader.readAsDataURL(file); 
};
const toggleAssignee = (item, name) => {
  const idx = item.assignees.indexOf(name);
  if (idx > -1) item.assignees.splice(idx, 1);
  else item.assignees.push(name);
};
const addDummyItem = () => {
  receiptItems.value.push({ name: '', price: null, qty: 1, taxRate: 0, assignees: [] });
};

// 🌟 小計・合計の計算ロジック
const calcItemTotal = (item) => {
  const base = (Number(item.price) || 0) * (item.qty || 1);
  return Math.floor(base * (1 + (item.taxRate / 100)));
};

const itemsTotal = computed(() => {
  return receiptItems.value.reduce((sum, item) => sum + calcItemTotal(item), 0);
});

// 🌟 税率の切り替え機能
const toggleTax = (item) => {
  if (item.taxRate === 0) item.taxRate = 8;
  else if (item.taxRate === 8) item.taxRate = 10;
  else item.taxRate = 0;
};
const setGlobalTax = (rate) => {
  receiptItems.value.forEach(item => item.taxRate = rate);
};

// 🌟 緩やかな送信チェック（美しいモーダルに統一！）
const handleSubmit = () => {
  if (!formData.value.amount || !formData.value.itemName) {
    showModal({ type: 'error', title: '入力エラー', message: '合計金額と店名・内容は必須です！' });
    return;
  }
  
  if (formData.value.splitType === 'item') {
    const unassignedItem = receiptItems.value.find(item => item.assignees.length === 0);
    if (unassignedItem) {
      showModal({ type: 'error', title: '選択モレ', message: `「${unassignedItem.name}」を支払う人が選択されていません！` });
      return;
    }

    // 金額がズレている場合は差額を表示。直すか、立替者が差額を負担して保存かを選べる
    if (itemsTotal.value !== Number(formData.value.amount)) {
      const diff = Number(formData.value.amount) - itemsTotal.value;
      const diffText = diff > 0 ? `¥${diff.toLocaleString()} 足りません` : `¥${Math.abs(diff).toLocaleString()} 多いです`;
      showModal({
        type: 'warning',
        title: '金額が合っていません',
        message: `内訳の合計（¥${itemsTotal.value.toLocaleString()}）が全体（¥${Number(formData.value.amount).toLocaleString()}）と${diffText}。\n\n商品の金額か担当を直すか、この差額を立替者（${formData.value.payer || '立替者'}）が負担してよければこのまま保存できます。`,
        showCancel: true,
        confirmText: 'このまま保存',
        cancelText: '戻って直す',
        onConfirm: () => executeSubmit(),
      });
      return;
    }
  }

  // 🌟 金額指定（custom）の整合チェック
  if (formData.value.splitType === 'custom') {
    let sum = 0;
    (props.participants || []).forEach(p => { sum += Number(customSplitAmounts.value[p.name]) || 0; });
    if (sum <= 0) {
      showModal({ type: 'error', title: '入力エラー', message: '各メンバーの金額を入力してください。' });
      return;
    }
    if (sum !== Number(formData.value.amount)) {
      const diff = Number(formData.value.amount) - sum;
      const diffText = diff > 0 ? `¥${diff.toLocaleString()} 足りません` : `¥${Math.abs(diff).toLocaleString()} 多いです`;
      showModal({
        type: 'warning',
        title: '金額が合っていません',
        message: `指定の合計（¥${sum.toLocaleString()}）が全体（¥${Number(formData.value.amount).toLocaleString()}）と${diffText}。\n\n各メンバーの金額を直すか、この差額を立替者（${formData.value.payer || '立替者'}）が負担してよければこのまま保存できます。`,
        showCancel: true,
        confirmText: 'このまま保存',
        cancelText: '戻って直す',
        onConfirm: () => executeSubmit(),
      });
      return;
    }
  }

  // 金額が合っている場合はそのまま送信
  executeSubmit();
};

// 🌟 各メンバーの「負担額」を割り勘方法に応じて算出（uid基準・立替者の自己負担も含む）
const computeShares = () => {
  const arr = props.participants || [];
  const shares = {};
  const nameToUid = {};
  arr.forEach(p => { shares[p.id] = 0; nameToUid[p.name] = p.id; });

  if (formData.value.splitType === 'custom') {
    // 金額指定：各人が入力した額がそのまま負担額
    arr.forEach(p => { shares[p.id] = Number(customSplitAmounts.value[p.name]) || 0; });
  } else if (formData.value.splitType === 'item') {
    // 商品ごと：各商品を支払う人で均等割りし、合算
    receiptItems.value.forEach(item => {
      const price = calcItemTotal(item);
      const assignees = item.assignees || [];
      if (assignees.length === 0) return;
      const per = Math.floor(price / assignees.length);
      assignees.forEach(name => {
        const uid = nameToUid[name];
        if (uid != null) shares[uid] += per;
      });
    });
  } else {
    // 全員で均等
    const per = Math.floor(Number(formData.value.amount) / (arr.length || 1));
    arr.forEach(p => { shares[p.id] = per; });
  }

  // 🌟 端数（切り捨て）で合計より少なくなる分は立替者が負担し、割り勘合計を必ず総額に一致させる
  //    → 「1円足りなくて決済が通らない」を根本から防ぐ
  const total = Number(formData.value.amount) || 0;
  const sum = arr.reduce((s, p) => s + (shares[p.id] || 0), 0);
  const diff = total - sum;
  if (diff !== 0) {
    const payerObj = arr.find(p => p.name === formData.value.payer) || arr.find(p => p.isMe) || arr[0];
    if (payerObj) shares[payerObj.id] = (shares[payerObj.id] || 0) + diff;
  }

  return arr.map(p => ({ uid: p.id, name: p.name, amount: shares[p.id] || 0 }));
};

// 🌟 実際の送信処理（モーダルのOKボタンからも呼べるように分けたもの）
const executeSubmit = () => {
  console.log("🔥 モーダル内の送信処理を開始"); // 🌟 これが出るか？
  
  // new Date().toLocaleTimeString... の部分でエラーが出ることがあるので
  // 以下のように安全な書き方に変更してみてください
  const now = new Date();
  const currentTime = formData.value.time || 
                     `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 🌟 立替えた人（債権者）のUIDを名前から解決して一緒に渡す
  const payerObj = (props.participants || []).find(p => p.name === formData.value.payer);
  const payload = {
    editId: props.editData ? props.editData.id : null, // 🌟 編集なら対象ID
    payer: formData.value.payer,
    payerUid: payerObj ? payerObj.id : (props.myUid || null),
    itemName: formData.value.itemName,
    category: formData.value.category, // 🌟 支払いジャンル
    registrationNumber: formData.value.registrationNumber || null, // 🌟 事業者登録番号
    splitType: formData.value.splitType,
    amount: Number(formData.value.amount),
    date: formData.value.date ? formData.value.date.replace(/-/g, '/') : "",
    time: currentTime,
    // 🌟 各メンバーの負担額（割り勘の正データ）
    shares: computeShares(),
    items: receiptItems.value.map(item => ({
      name: item.name,
      price: calcItemTotal(item),
      assignees: item.assignees
    }))
  };

  console.log("📦 パケット作成完了:", payload);
  emit('submit', payload);
  emit('close'); // 🌟 送信後に閉じる指示を出す
};
</script>

<style scoped>
/* 🌟 モーダル全体のベース */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
.modal-content { background: #f4f7f9; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; display: flex; flex-direction: column; max-height: 90vh; }

.modal-header { padding: 26px 22px 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 1px solid rgba(0,0,0,0.06); background: white; border-radius: 28px 28px 0 0; flex-shrink: 0; }
.modal-title { margin: 0; font-size: 20px; color: #0f172a; font-weight: 900; line-height: 1.3; }
.close-btn { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; color: #64748b; cursor: pointer; font-weight: bold; }

.scroll-area { overflow-y: auto; padding: 20px 24px; flex: 1; }

/* 🌟 1. レシート撮影・選択エリア */
.upload-section { margin-bottom: 24px; }
.hidden-input { display: none; }
.drop-zone { border: 2px dashed #cbd5e1; border-radius: 20px; background: white; padding: 20px; text-align: center; transition: 0.2s; position: relative; overflow: hidden; min-height: 140px; display: flex; align-items: center; justify-content: center; }
.drop-zone.is-dragover { border-color: var(--c-brand); background: var(--c-brand-weak); }
.drop-zone.is-analyzing { border-color: #f59e0b; background: #fffbeb; }

.upload-placeholder { width: 100%; }
.upload-hint { font-size: 13px; font-weight: 800; color: #64748b; margin: 0 0 15px 0; }
.upload-actions { display: flex; gap: 10px; justify-content: center; }
.upload-action-btn { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 16px; font-size: 12px; font-weight: 900; color: #1e293b; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.upload-action-btn:active { transform: scale(0.96); background: #e2e8f0; }
.upload-action-btn__icon { width: 26px; height: 26px; fill: none; stroke: var(--c-brand); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }

/* AI解析中のアニメーション */
.analyzing-view { width: 100%; height: 100%; position: absolute; top: 0; left: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.7); z-index: 10; }
.scanning-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; position: absolute; top: 0; left: 0; }
.scan-line { position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: var(--c-brand); box-shadow: 0 0 15px var(--c-brand); animation: scan 1.5s infinite linear; z-index: 11; }
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
/* 🌟 日付と時間は「縦並び」にする（横並びだと密着して見えるため確実に分離） */
.half-row { display: flex; flex-direction: column; gap: 18px; }
.half { width: 100%; min-width: 0; }
.half .standard-input { width: 100%; min-width: 0; }

.amount-input-wrapper { display: flex; align-items: baseline; gap: 4px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; transition: 0.2s; }
.amount-input-wrapper:focus-within { border-color: #f59e0b; }
.currency-mark { font-size: 24px; font-weight: 900; color: #1e293b; }
.amount-input { flex: 1; border: none; outline: none; font-size: 36px; font-weight: 900; color: #f59e0b; background: transparent; letter-spacing: -1px; width: 100%; }
.amount-input::placeholder { color: #cbd5e1; }
.currency-unit { font-size: 16px; font-weight: 800; color: #64748b; }

.standard-input { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-size: 14px; font-weight: 800; color: #1e293b; outline: none; box-sizing: border-box; transition: 0.2s; }
.standard-input:focus { border-color: var(--c-brand); background: white; }
.select-style { appearance: none; cursor: pointer; }
.payer-hint { font-size: 11px; color: #059669; background: #ecfdf5; padding: 8px 12px; border-radius: 10px; margin: 0; font-weight: 700; }

/* 🌟 支払いジャンル選択 */
.category-section { margin-bottom: 20px; }
.category-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 6px; -webkit-overflow-scrolling: touch; }
.category-row::-webkit-scrollbar { height: 0; }
.cat-chip { flex: 0 0 auto; width: 64px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 10px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; color: #64748b; cursor: pointer; transition: 0.15s; }
.cat-chip:active { transform: scale(0.96); }
.cat-icon { width: 24px; height: 24px; color: #64748b; }
.cat-label { font-size: 10px; font-weight: 800; }
.cat-chip.active { border-color: var(--c-brand); background: var(--c-brand-weak); color: var(--c-brand-strong); }
.cat-chip.active .cat-icon { color: var(--c-brand); }

/* 🌟 3. 割り勘タイプ選択 */
.split-type-section { margin-bottom: 16px; }
.section-sub-title { font-size: 14px; font-weight: 900; color: #0f172a; margin: 0 0 10px 0; }
.ios-segmented-control { display: flex; background: #e2e8f0; border-radius: 12px; padding: 4px; }
.ios-segmented-control button { flex: 1; padding: 10px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: #64748b; border-radius: 10px; cursor: pointer; transition: 0.2s; }
.ios-segmented-control button.active { background: white; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

/* 🌟 4. 動的セクション */
.dynamic-section { margin-bottom: 24px; }
.section-desc { font-size: 12px; color: #64748b; font-weight: 700; margin: 0 0 12px 0; }

.split-result-box { background: white; border: 2px solid var(--c-brand); border-radius: 20px; padding: 20px; text-align: center; }
.split-desc { font-size: 12px; color: var(--c-brand); font-weight: 800; }
.split-calc-amount { font-size: 28px; font-weight: 900; color: #1e293b; margin: 8px 0 0 0; }

/* カスタム（金額指定） */
.custom-split-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.remaining-text { font-size: 13px; font-weight: 900; color: var(--c-brand); background: var(--c-brand-weak); padding: 4px 10px; border-radius: 12px; transition: 0.2s; }
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
.add-item-btn { background: var(--c-brand-weak); color: var(--c-brand); border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; }
.receipt-items-list { display: flex; flex-direction: column; gap: 12px; }
.empty-items { background: white; padding: 30px; text-align: center; border-radius: 20px; border: 2px dashed #cbd5e1; font-size: 12px; font-weight: 800; color: #94a3b8; }
.receipt-item-card { background: white; border-radius: 20px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
.item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.item-name-input { flex: 1; border: none; border-bottom: 2px solid #e2e8f0; font-size: 15px; font-weight: 900; color: #1e293b; padding-bottom: 4px; outline: none; }
.item-price-box { display: flex; align-items: baseline; gap: 2px; font-weight: 800; color: #64748b; }
.item-price-input { width: 60px; text-align: right; border: none; border-bottom: 2px solid #e2e8f0; font-size: 16px; font-weight: 900; color: #f59e0b; outline: none; }
.remove-item-btn { background: #fef2f2; color: var(--c-danger); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.remove-item-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

.item-assignees { background: #f8fafc; padding: 12px; border-radius: 12px; }
.assign-label { font-size: 11px; color: #64748b; font-weight: 800; display: block; margin-bottom: 8px; }
.assign-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { background: white; border: 1px solid #cbd5e1; color: #64748b; padding: 6px 12px; border-radius: 16px; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.chip.selected { background: var(--c-brand); border-color: var(--c-brand); color: white; box-shadow: 0 2px 6px rgba(59,130,246,0.3); }

/* 🌟 フッター（固定） */
.modal-footer { padding: 16px 24px 30px; background: white; border-top: 1px solid rgba(0,0,0,0.05); }
.submit-btn { width: 100%; background-color: var(--c-brand); color: white; border: none; padding: 18px; border-radius: var(--r-pill); font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(5,150,105,0.25); transition: 0.2s; }
.submit-btn:active { transform: scale(0.96); }

.slide-in { animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* 🌟 追加：金額一致チェックのスタイル */
.header-left { display: flex; flex-direction: column; gap: 6px; }
.match-status { font-size: 13px; font-weight: 900; margin: 0; padding: 4px 10px; border-radius: 8px; display: inline-block; align-self: flex-start; transition: 0.3s; }
.match-status.matched { color: #10b981; background: #d1fae5; }
.match-status.error { color: #ef4444; background: #fee2e2; border: 1px dashed #ef4444; }

/* 🌟 UX向上：商品ごとのレイアウト */
.global-tax-control { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 11px; font-weight: 800; color: #64748b; }
.global-tax-btn { padding: 6px 10px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; cursor: pointer; color: #475569; font-weight: bold; transition: 0.2s; }
.global-tax-btn:active { background: #f1f5f9; }

.item-main-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.item-math-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.math-sign { font-size: 14px; font-weight: bold; color: #94a3b8; }

.qty-control { display: flex; align-items: center; background: #f1f5f9; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
.qty-control button { width: 32px; height: 32px; border: none; background: transparent; color: #475569; font-size: 16px; font-weight: bold; cursor: pointer; }
.qty-control button:active { background: #e2e8f0; }
.qty-control span { width: 24px; text-align: center; font-size: 14px; font-weight: 900; color: #1e293b; }

.tax-toggle-btn { padding: 6px 10px; border-radius: 10px; font-size: 12px; font-weight: 900; border: 1px solid #cbd5e1; cursor: pointer; background: white; transition: 0.2s; }
.tax-toggle-btn.tax-0 { color: #64748b; }
.tax-toggle-btn.tax-8 { color: #f59e0b; border-color: #f59e0b; background: #fffbeb; }
.tax-toggle-btn.tax-10 { color: #ef4444; border-color: #ef4444; background: #fef2f2; }

.item-subtotal { text-align: right; font-size: 12px; color: #64748b; margin-bottom: 16px; font-weight: 700; border-bottom: 1px dashed #e2e8f0; padding-bottom: 12px; }
.item-subtotal strong { font-size: 18px; color: #0f172a; margin-left: 6px; }

.header-left { display: flex; flex-direction: column; gap: 6px; }
.match-status { font-size: 12px; font-weight: 900; margin: 0; padding: 6px 12px; border-radius: 10px; display: inline-block; align-self: flex-start; transition: 0.3s; }
.match-status.matched { color: #10b981; background: #d1fae5; }
.match-status.error { color: #ef4444; background: #fee2e2; border: 1px dashed #ef4444; }
</style>