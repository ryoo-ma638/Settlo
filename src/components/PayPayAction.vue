<template>
    <div class="paypay-action-wrapper">
      <template v-if="mode === 'remind'">
        <div v-if="isEditingLink || !myPayPayLink" class="link-input-area">
          <input 
            v-model="inputLink" 
            type="text" 
            placeholder="https://qr.paypay... を貼る" 
            class="paypay-input"
          />
          <button class="save-btn" @click="saveMyLink">保存</button>
          <button v-if="myPayPayLink" class="cancel-btn" @click="isEditingLink = false">×</button>
        </div>
        <div v-else class="link-display-area">
          <button @click="copyMyLink" class="method-btn paypay">
            📱 自分の請求リンクをコピー
          </button>
          <button class="edit-text-btn" @click="startEdit">リンクを再登録する</button>
        </div>
      </template>
  
      <template v-else>
        <button 
          @click="payToOpponent" 
          class="method-btn paypay" 
          :class="{ 'disabled': !opponentPayPayLink }"
          :disabled="!opponentPayPayLink"
        >
          📱 PayPayで支払う {{ !opponentPayPayLink ? '(相手がリンク未登録)' : '' }}
        </button>
      </template>
  
      <BaseModal 
        :show="alertState.show"
        :type="alertState.type"
        :title="alertState.title"
        :message="alertState.message"
        @close="alertState.show = false"
      />
    </div>
  </template>
  
  <script setup>
  import { ref, watch, onMounted, reactive } from 'vue';
  import { db, auth } from '@/firebase';
  import { doc, getDoc, updateDoc } from 'firebase/firestore';
  import { onAuthStateChanged } from 'firebase/auth';
  import BaseModal from './BaseModal.vue'; // ✨ 統一モーダルをインポート
  
  const props = defineProps({
    mode: String, // 'remind' or 'pay'
    opponentUid: String, // 相手のUID
  });
  
  // --- 状態管理 ---
  const myPayPayLink = ref('');
  const opponentPayPayLink = ref('');
  const inputLink = ref('');
  const isEditingLink = ref(false);
  
  // インターフェース用のモーダル状態
  const alertState = reactive({ show: false, type: 'info', title: '', message: '' });
  
  const showAlert = (type, title, message) => {
    alertState.type = type;
    alertState.title = title;
    alertState.message = message;
    alertState.show = true;
  };
  
  // --- バックエンド機能（Firestore連携） ---
  
  // 相手のリンクを取得
  const fetchOpponentLink = async (uid) => {
    if (!uid) return;
    try {
      const oppSnap = await getDoc(doc(db, "users", uid));
      if (oppSnap.exists() && oppSnap.data().paypayLink) {
        opponentPayPayLink.value = oppSnap.data().paypayLink;
      }
    } catch(e) { console.error("相手のリンク取得エラー:", e); }
  };
  
  onMounted(() => {
    // 自分のリンクを取得
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const mySnap = await getDoc(doc(db, "users", user.uid));
          if (mySnap.exists() && mySnap.data().paypayLink) {
            myPayPayLink.value = mySnap.data().paypayLink;
            inputLink.value = myPayPayLink.value;
          }
        } catch(e) { console.error("自分のリンク取得エラー:", e); }
      }
    });
    fetchOpponentLink(props.opponentUid);
  });
  
  // UIDが変わったら相手のリンクを取り直す
  watch(() => props.opponentUid, (newUid) => fetchOpponentLink(newUid));
  
  const startEdit = () => {
    inputLink.value = myPayPayLink.value;
    isEditingLink.value = true;
  };
  
  // 自分のリンクをFirestoreに保存（バックエンド機能）
  const saveMyLink = async () => {
    // ✨ PayPayリンクの仕様に合わせたバリデーション ✨
    if (!inputLink.value.startsWith('https://qr.paypay') && !inputLink.value.startsWith('https://paypay.me')) {
      showAlert('error', 'リンクが違います', 'PayPayアプリで発行した「請求リンク（https://qr.paypay...）」を入力してください。');
      return;
    }
    
    const myUid = auth.currentUser?.uid;
    if (!myUid) { showAlert('error', 'エラー', 'ログイン状態が確認できません。'); return; }
  
    try {
      // 🔥 Firestoreをアップデート
      await updateDoc(doc(db, "users", myUid), { paypayLink: inputLink.value });
      myPayPayLink.value = inputLink.value;
      isEditingLink.value = false;
      showAlert('success', '保存完了', 'あなたのPayPay受け取りリンクを登録しました！');
    } catch (error) {
      console.error("リンク保存エラー:", error);
      showAlert('error', '保存失敗', 'データベースへの保存に失敗しました。電波状況を確認してください。');
    }
  };
  
  // クリップボードにコピー
  const copyMyLink = () => {
    navigator.clipboard.writeText(myPayPayLink.value)
      .then(() => showAlert('success', 'コピーしました', 'リンクをコピーしました！LINEやメッセージに貼り付けて相手に送ってください。'))
      .catch(() => showAlert('error', 'コピー失敗', 'クリップボードへのアクセスが許可されていません。'));
  };
  
  // 相手のリンクを開く
  const payToOpponent = () => {
    if (opponentPayPayLink.value) {
      window.open(opponentPayPayLink.value, '_blank');
    }
  };
  </script>
  
  <style scoped>
  /* スタイルは前回と同じ */
  .paypay-action-wrapper { width: 100%; margin-bottom: 10px; }
  .method-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; font-weight: bold; cursor: pointer; text-align: center; font-size: 15px;}
  .paypay { background-color: #ff0033; color: white; transition: 0.2s; box-shadow: 0 4px 12px rgba(255,0,51,0.2); display: block; }
  .paypay:active { transform: scale(0.96); }
  .paypay.disabled { background-color: #cbd5e1; box-shadow: none; cursor: not-allowed; }
  .link-input-area { display: flex; gap: 8px; align-items: center; }
  .paypay-input { flex: 1; padding: 14px 12px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; outline: none; }
  .paypay-input:focus { border-color: #ff0033; }
  .save-btn { background: #1e293b; color: white; border: none; padding: 0 16px; height: 46px; border-radius: 12px; font-weight: bold; cursor: pointer; }
  .cancel-btn { background: #e2e8f0; color: #64748b; border: none; width: 46px; height: 46px; border-radius: 12px; font-weight: bold; cursor: pointer; }
  .link-display-area { display: flex; flex-direction: column; align-items: center; }
  .edit-text-btn { background: none; border: none; color: #64748b; font-size: 12px; margin-top: 10px; text-decoration: underline; cursor: pointer; }
  </style>