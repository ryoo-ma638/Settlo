<template>
    <div class="paypay-action-wrapper">
      <template v-if="mode === 'remind'">
        <div v-if="isEditingLink || !myPayPayLink" class="link-input-area">
          <input 
            v-model="inputLink" 
            :disabled="saving"
            type="text" 
            placeholder="https://qr.paypay... を貼る" 
            class="paypay-input"
          />
          <button class="save-btn" :disabled="saving" @click="saveMyLink">{{ saving ? '保存中…' : '保存' }}</button>
          <button v-if="myPayPayLink" class="cancel-btn" :disabled="saving" @click="isEditingLink = false" aria-label="キャンセル">×</button>
        </div>
        <div v-else class="link-display-area">
          <button @click="copyMyLink" class="method-btn paypay">
            自分の請求リンクをコピー
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
          PayPayで支払う {{ opponentLinkMessage }}
        </button>
        <button v-if="opponentLinkState === 'error'" class="edit-text-btn" @click="fetchOpponentLink">リンクを再取得する</button>
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
  import { ref, computed, watch, onMounted, onBeforeUnmount, reactive } from 'vue';
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
  const saving = ref(false);
  const currentUid = ref('');
  const opponentLinkState = ref('idle');
  const opponentLinkMessage = computed(() => ({
    idle: '(相手を確認できません)',
    loading: '(リンクを確認中)',
    empty: '(相手がリンク未登録)',
    error: '(リンクを取得できませんでした)',
    ready: '',
  }[opponentLinkState.value]));
  let opponentRequest = 0;
  let ownRequest = 0;
  let accountVersion = 0;
  let loadedOpponentUid = '';
  let unsubscribeAuth;
  let active = true;
  
  // インターフェース用のモーダル状態
  const alertState = reactive({ show: false, type: 'info', title: '', message: '' });
  
  const showAlert = (type, title, message) => {
    alertState.type = type;
    alertState.title = title;
    alertState.message = message;
    alertState.show = true;
  };
  
  // --- バックエンド機能（Firestore連携） ---
  
  // 切替直後に旧リンクを消し、最後に開始した取得だけを反映する。
  const fetchOpponentLink = async () => {
    const request = ++opponentRequest;
    const uid = props.opponentUid;
    opponentPayPayLink.value = '';
    loadedOpponentUid = '';
    opponentLinkState.value = 'idle';
    if (!active || props.mode !== 'pay' || !currentUid.value || !uid || uid === currentUid.value) return;
    opponentLinkState.value = 'loading';
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!active || request !== opponentRequest) return;
      const link = snap.exists() ? snap.data().paypayLink : '';
      opponentPayPayLink.value = typeof link === 'string' ? link : '';
      loadedOpponentUid = uid;
      opponentLinkState.value = opponentPayPayLink.value ? 'ready' : 'empty';
    } catch (error) {
      if (!active || request !== opponentRequest) return;
      opponentLinkState.value = 'error';
      console.error('相手のリンク取得エラー:', error);
    }
  };

  watch(() => [props.opponentUid, props.mode, currentUid.value], fetchOpponentLink, { flush: 'sync' });
  
  onMounted(() => {
    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const request = ++ownRequest;
      ++accountVersion;
      currentUid.value = user?.uid || '';
      myPayPayLink.value = '';
      inputLink.value = '';
      isEditingLink.value = false;
      saving.value = false;
      alertState.show = false;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!active || request !== ownRequest) return;
        const link = snap.exists() ? snap.data().paypayLink : '';
        myPayPayLink.value = typeof link === 'string' ? link : '';
        if (!inputLink.value) inputLink.value = myPayPayLink.value;
      } catch (error) {
        if (!active || request !== ownRequest) return;
        console.error('自分のリンク取得エラー:', error);
        showAlert('error', 'リンク取得失敗', '登録したリンクを取得できませんでした。通信状態を確認して画面を開き直してください。');
      }
    });
  });

  onBeforeUnmount(() => {
    active = false;
    ++opponentRequest;
    ++ownRequest;
    unsubscribeAuth?.();
  });
  
  const startEdit = () => {
    inputLink.value = myPayPayLink.value;
    isEditingLink.value = true;
  };
  
  // 自分のリンクをFirestoreに保存（バックエンド機能）
  const saveMyLink = async () => {
    if (saving.value || !active) return;
    const link = inputLink.value.trim();
    // ✨ PayPayリンクの仕様に合わせたバリデーション ✨
    if (!link.startsWith('https://qr.paypay') && !link.startsWith('https://paypay.me')) {
      showAlert('error', 'リンクが違います', 'PayPayアプリで発行した「請求リンク（https://qr.paypay...）」を入力してください。');
      return;
    }
    
    const myUid = auth.currentUser?.uid;
    if (!myUid) { showAlert('error', 'エラー', 'ログイン状態が確認できません。'); return; }
  
    const version = accountVersion;
    ++ownRequest;
    saving.value = true;
    const stillCurrent = () => active && version === accountVersion && auth.currentUser?.uid === myUid;
    try {
      // 入力時点の値を保存し、同じ値を画面にも反映する。
      await updateDoc(doc(db, "users", myUid), { paypayLink: link });
      if (!stillCurrent()) return;
      myPayPayLink.value = link;
      inputLink.value = link;
      isEditingLink.value = false;
      showAlert('success', '保存完了', 'あなたのPayPay受け取りリンクを登録しました！');
    } catch (error) {
      if (!stillCurrent()) return;
      console.error("リンク保存エラー:", error);
      showAlert('error', '保存失敗', 'データベースへの保存に失敗しました。電波状況を確認してください。');
    } finally {
      if (stillCurrent()) saving.value = false;
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
    if (active && props.mode === 'pay' && auth.currentUser?.uid === currentUid.value &&
        loadedOpponentUid === props.opponentUid && opponentLinkState.value === 'ready' && opponentPayPayLink.value) {
      window.open(opponentPayPayLink.value, '_blank', 'noopener,noreferrer');
    }
  };
  </script>
  
  <style scoped>
  /* スタイルは前回と同じ */
  .paypay-action-wrapper { width: 100%; margin-bottom: 10px; }
  .method-btn { width: 100%; padding: 15px; border-radius: 14px; border: none; font-weight: bold; cursor: pointer; text-align: center; font-size: 15px;}
  .paypay { background-color: var(--c-paypay); color: white; transition: 0.2s; box-shadow: 0 4px 12px rgba(255,0,51,0.2); display: block; }
  .paypay:active { transform: scale(0.96); }
  .paypay.disabled { background-color: var(--c-line-strong); box-shadow: none; cursor: not-allowed; }
  .link-input-area { display: flex; gap: 8px; align-items: center; }
  .paypay-input { flex: 1; padding: 14px 12px; border: 1px solid var(--c-line-strong); border-radius: 12px; font-size: 14px; outline: none; }
  .paypay-input:focus { border-color: var(--c-paypay); }
  .save-btn { background: var(--c-brand); color: white; border: none; padding: 0 16px; height: 46px; border-radius: 12px; font-weight: bold; cursor: pointer; }
  .cancel-btn { background: var(--c-line-bold); color: var(--c-text-sub); border: none; width: 46px; height: 46px; border-radius: 12px; font-weight: bold; cursor: pointer; }
  .link-display-area { display: flex; flex-direction: column; align-items: center; }
  .edit-text-btn { background: none; border: none; color: var(--c-text-sub); font-size: 12px; margin-top: 10px; text-decoration: underline; cursor: pointer; }
  </style>