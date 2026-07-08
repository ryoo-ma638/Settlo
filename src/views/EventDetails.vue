<template>
  <div class="event-detail-container">
    <PageHeader title="イベント詳細" />

    <main class="content">
      <div class="summary-card">
        <div class="card-top">
          <div class="event-title-wrap">
            <span class="event-genre"><GenreIcon :type="eventData.tag" /></span>
            <h2 class="event-name">{{ eventData.name }}</h2>
          </div>
          <button class="event-edit-btn" @click="openEditEvent">編集</button>
        </div>
        
        <div class="total-section clickable" @click="scrollToTimeline">
          <span class="label">未精算の残り <span class="arrow-down">履歴を見る ↓</span></span>
          <h1 class="total-amount">¥{{ outstandingTotal.toLocaleString() }}</h1>
          <span class="total-sub">立替の合計 ¥{{ eventData.total.toLocaleString() }}</span>

          <div class="progress-wrap" v-if="settlementProgress.total > 0">
            <div class="progress-bar"><div class="progress-fill" :style="{ width: settlementProgress.percent + '%' }"></div></div>
            <span class="progress-text">{{ settlementProgress.done }}/{{ settlementProgress.total }}件 精算済み（{{ settlementProgress.percent }}%）</span>
          </div>
        </div>

        <div class="participants-section" @click="openParticipants">
          <div class="participants-header">
            <span class="label">参加者 ({{ eventData.participants.length }}名)</span>
            <span class="arrow">›</span>
          </div>
          <div class="participants-row">
            <div class="avatar-stack">
              <template v-for="(p, i) in eventData.participants.slice(0, 5)" :key="i">
                <div class="avatar" :style="{ zIndex: 10 - i }">
                  <img
                    v-if="p.color && p.color.startsWith('http')"
                    :src="p.color"
                    class="avatar__img"
                  />
                  <div
                    v-else
                    class="avatar__ph"
                    :style="{ backgroundColor: p.color || '#cbd5e1' }"
                  ></div>
                </div>
              </template>
              <div v-if="eventData.participants.length > 5" class="avatar-more">
                +{{ eventData.participants.length - 5 }}
              </div>
            </div>
            <button class="invite-pill-btn" @click.stop="inviteUser">
              <span class="icon">＋</span> 招待
            </button>
          </div>
        </div>

        <div class="invite-code-bar">
          <span class="icb-label">招待コード</span>
          <span class="icb-code">{{ eventData.invitationCode }}</span>
          <button class="icb-copy" @click="copyInviteCode">コピー</button>
        </div>
      </div>

      <div class="settlement-summary-section">
        <h3 class="section-title">精算サマリー</h3>
        
        <div class="filter-wrapper">
          <div class="ios-segmented-control">
            <button :class="{ active: sumFilterScope === 'all' }" @click="sumFilterScope = 'all'">全体</button>
            <button :class="{ active: sumFilterScope === 'me' }" @click="sumFilterScope = 'me'">自分のみ</button>
          </div>
          <div class="custom-select-wrapper">
            <select v-model="sharedFilterStatus" class="ios-select">
              <option value="unpaid">未決済のみ</option>
              <option value="all">すべて</option>
              <option value="completed">精算済み</option>
            </select>
          </div>
        </div>
        <div class="summary-list">
          <div v-if="filteredSummary.length === 0" class="empty-state">該当する精算はありません</div>
          <div class="summary-card-item" v-for="sum in filteredSummary" :key="sum.id" @click="openSummaryDetail(sum)">
            <div class="flow">
              <img v-if="sum.fromPhoto" :src="sum.fromPhoto" class="avatar-small" />
              <div v-else class="avatar-small" :style="{ backgroundColor: sum.fromColor }"></div>
              <span class="name">{{ sum.from }}</span>
              <span class="arrow-right">→</span>
              <img v-if="sum.toPhoto" :src="sum.toPhoto" class="avatar-small" />
              <div v-else class="avatar-small" :style="{ backgroundColor: sum.toColor }"></div>
              <span class="name">{{ sum.to }}</span>
            </div>
            <div class="amount-right">
              <span v-if="sum.status === 'completed'" class="badge paid">完了</span>
              <div class="amount" :class="sum.isMePayer ? 'orange-text' : 'blue-text'">
                ¥{{ sum.amount.toLocaleString() }} <span class="arrow-icon">›</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="history-section" ref="timelineSection">
        <div class="section-header">
          <h3 class="section-title">立て替え履歴</h3>
          <button class="add-payment-btn" @click="openNewPayment">＋ 支払いを追加</button>
        </div>

        <div class="filter-wrapper">
          <div class="ios-segmented-control">
            <button :class="{ active: histFilterScope === 'all' }" @click="histFilterScope = 'all'">全体</button>
            <button :class="{ active: histFilterScope === 'me' }" @click="histFilterScope = 'me'">自分のみ</button>
          </div>
          <div class="custom-select-wrapper auto-width">
            <select v-model="sharedFilterStatus" class="ios-select">
              <option value="unpaid">未決済のみ</option>
              <option value="all">すべて</option>
              <option value="completed">精算済み</option>
            </select>
          </div>
          <div class="custom-select-wrapper auto-width">
            <select v-model="histSort" class="ios-select">
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
            </select>
          </div>
        </div>

        <div class="timeline">
          <div v-if="filteredHistory.length === 0" class="empty-state">該当する履歴はありません</div>
          
          <div class="timeline-item" v-for="history in filteredHistory" :key="history.id" @click="openHistoryDetail(history)">
            <div class="timeline-line"></div>
            <div class="timeline-dot" :style="{ backgroundColor: history.color }"></div>
            
            <div class="timeline-content">
              <div class="history-card" :class="{ 'unpaid-card': history.status === 'unpaid' }">
                <div class="history-main">
                  <div class="history-avatar history-avatar--cat">
                    <GenreIcon :type="history.category" />
                  </div>

                  <div class="history-text">
                    <span class="history-item-name">{{ history.itemName }} <span class="split-type">{{ history.splitType }}</span></span>
                    <span class="history-payer">{{ history.date }} {{ history.time }} • {{ history.payer }} が立替</span>
                  </div>
                </div>
                <div class="history-right">
                  <span class="history-price">¥{{ history.amount.toLocaleString() }}</span>
                  <span v-if="history.status !== 'unpaid'" class="badge paid">精算済</span>
                  <span v-else-if="isMyPayment(history)" class="badge receive">受取待ち ¥{{ myReceivableOf(history).toLocaleString() }}</span>
                  <span v-else-if="myShareOf(history) > 0" class="badge owe">あなた ¥{{ myShareOf(history).toLocaleString() }}</span>
                  <span v-else class="badge pending">未精算</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="eventData.ended" class="ended-chip">このイベントは終了しています（精算済み・記録として保存）</div>
      <template v-else>
        <button class="end-event-btn" @click="handleEndEvent">イベントを終了する</button>
        <p class="end-hint">みんなの精算をすべて済ませて、イベントを締めます（記録は残ります）。</p>
      </template>

      <button class="delete-event-btn" @click="handleDeleteEvent">イベントを削除する</button>
      <p class="end-hint">自分の画面から非表示にします。ゴミ箱から7日以内なら復元できます（相手の画面には残ります）。</p>
    </main>

    <Teleport to="body">
      <BaseModal
        :show="alertState.show"
        :type="alertState.type"
        :title="alertState.title"
        :message="alertState.message"
        :showCancel="alertState.showCancel"
        :confirmText="alertState.confirmText"
        :cancelText="alertState.cancelText"
        @confirm="handleAlertConfirm"
        @cancel="alertState.show = false"
        @close="alertState.show = false"
      />
      <BaseModal
        :show="modals.unpaidWarning"
        type="warning"
        title="イベントの決済を確定しますか？"
        message="これ以上イベントを進めない場合は、残っている貸し借りをまとめて精算しましょう。精算サマリーで全員の負担が均等になる最小回数の送金にまとめられます。すべての決済が完了すると、イベントを終了できます。"
        confirmText="決済を確定する（精算へ）"
        cancelText="まだ進める"
        :showCancel="true"
        @confirm="modals.unpaidWarning = false; modals.summaryDetail = true"
        @cancel="modals.unpaidWarning = false"
        @close="modals.unpaidWarning = false"
      />
      <div v-if="modals.participants" class="modal-overlay" @click.self="modals.participants = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>参加者一覧</h3><button class="close-btn" @click="modals.participants = false" aria-label="閉じる">×</button></div>
          <div class="modal-list">
            <div class="list-item" v-for="p in eventData.participants" :key="p.id">
              <img
                v-if="p.color && p.color.startsWith('http')"
                :src="p.color"
                class="avatar-medium"
              />
              <div
                v-else
                class="avatar-medium"
                :style="{ backgroundColor: p.color || '#cbd5e1' }"
              ></div>
              <span class="item-name">{{ p.name }} <span v-if="p.isMe" class="me-badge">自分</span></span>
              <button v-if="!p.isMe && friendStatus[p.id] === 'none'" class="p-friend-btn" @click="sendFriendRequestTo(p)">フレンド申請</button>
              <span v-else-if="!p.isMe && friendStatus[p.id] === 'friend'" class="p-friend-tag">フレンド</span>
              <span v-else-if="!p.isMe && friendStatus[p.id] === 'requested'" class="p-friend-tag is-wait">申請済み</span>
              <button v-if="!p.isMe" class="p-remove-btn" @click="removeParticipant(p)" aria-label="外す">
                <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="modals.editEvent" class="modal-overlay" @click.self="modals.editEvent = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>イベントを編集</h3><button class="close-btn" @click="modals.editEvent = false" aria-label="閉じる">×</button></div>
          <div class="edit-body">
            <label class="edit-label">イベント名</label>
            <input v-model="editName" class="edit-input" placeholder="イベント名" />
            <label class="edit-label">ジャンル</label>
            <div class="edit-genre-grid">
              <button
                v-for="g in eventGenres" :key="g" type="button"
                class="edit-genre" :class="{ active: editTag === g }"
                @click="editTag = g"
              >
                <span class="edit-genre-icon"><GenreIcon :type="g" /></span>
                <span class="edit-genre-label">{{ g }}</span>
              </button>
            </div>
            <button class="edit-save-btn" @click="saveEventEdit">保存する</button>
          </div>
        </div>
      </div>

      <ReceiptPaymentModal :isOpen="modals.historyDetail" :history="selectedHistory" :myAmount="selectedMyAmount" :myRole="selectedMyRole" @close="modals.historyDetail = false" @complete="markAsCompleted" @edit="openEditPayment" @delete="deletePayment" />

      <div v-if="modals.summaryDetail && selectedSummary" class="modal-overlay" @click.self="modals.summaryDetail = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>精算の詳細</h3><button class="close-btn" @click="modals.summaryDetail = false" aria-label="閉じる">×</button></div>
          <div class="summary-detail-body">
            <div class="flow-large">
              <img v-if="selectedSummary.fromPhoto" :src="selectedSummary.fromPhoto" class="avatar-large" />
              <div v-else class="avatar-large" :style="{ backgroundColor: selectedSummary.fromColor }"></div>
              <span class="arrow-large">→</span>
              <img v-if="selectedSummary.toPhoto" :src="selectedSummary.toPhoto" class="avatar-large" />
              <div v-else class="avatar-large" :style="{ backgroundColor: selectedSummary.toColor }"></div>
            </div>
            <p class="s-text"><strong>{{ selectedSummary.from }}</strong> さんから<br><strong>{{ selectedSummary.to }}</strong> さんへ</p>
            <h1 class="s-amount" :class="selectedSummary.isMePayer ? 'orange-text' : 'blue-text'">¥{{ selectedSummary.amount.toLocaleString() }}</h1>
            
            <div v-if="selectedSummary.details && selectedSummary.details.length > 0" class="breakdown-list">
              <h4 class="breakdown-title">合算された内訳</h4>
              <div class="breakdown-item" v-for="(detail, i) in selectedSummary.details" :key="i">
                <span class="bd-name">{{ detail.itemName }}</span>
                <div class="bd-right">
                  <span class="bd-who">{{ detail.from }} → {{ detail.to }}</span>
                  <span class="bd-amount">¥{{ detail.amount.toLocaleString() }}</span>
                </div>
              </div>
            </div>
            
            <section v-if="selectedSummary.status === 'completed'" class="completed-section">
              <div class="completed-card">
                <span class="completed-icon"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>
                <h3 class="completed-title">この取引は完了しています</h3>
              </div>
            </section>
            <template v-else>
              <p class="s-hint">の支払いが残っています。</p>
              <button class="action-btn main" @click="goToBatchPayment(selectedSummary)">
                {{ selectedSummary.isMePayer ? 'まとめて支払う画面へ' : 'まとめて受け取る・催促へ' }}
              </button>
            </template>
          </div>
        </div>
      </div>

      <InviteModal
        :isOpen="modals.invite"
        :eventCode="eventData.invitationCode"
        :eventId="route.params.id"
        :eventName="eventData.name"
        :myName="myName"
        :participantUids="eventData.participants.map(p => p.id)"
        @close="modals.invite = false"
      />
      <AddPaymentModal
        :isOpen="modals.addPayment"
        :participants="eventData.participants"
        :myName="myName"
        :myUid="auth.currentUser?.uid || ''"
        :editData="editingHistory"
        @close="modals.addPayment = false; editingHistory = null"
        @submit="addHistory"
      />

      <transition name="toast-fade">
        <div v-if="toastMsg" class="settlo-toast">{{ toastMsg }}</div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { getDoc } from 'firebase/firestore'; // getDoc が必要

const userCache = {};
const getUserIcon = async (uid) => {
  if (!uid) return "#cbd5e1";
  if (userCache[uid]) return userCache[uid];
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const icon = data.photoURL || data.photo || data.color || "#cbd5e1";
      userCache[uid] = icon;
      return icon;
    }
  } catch (e) { console.error(e); }
  return "#cbd5e1";
};

// 🌟 参加者の「名前＋アイコン」を実データから取得（"メンバー" 固定表示を解消）
const userInfoCache = {};
const getUserInfo = async (uid) => {
  if (!uid) return { name: "メンバー", icon: "#cbd5e1" };
  if (userInfoCache[uid]) return userInfoCache[uid];
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const info = {
        name: data.name || "メンバー",
        icon: data.photoURL || data.photo || data.color || "#cbd5e1",
      };
      userInfoCache[uid] = info;
      return info;
    }
  } catch (e) { console.error(e); }
  return { name: "メンバー", icon: "#cbd5e1" };
};

// ==========================================
// 🌟 1. 2人の import を綺麗に合体！
// ==========================================
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'; // 🌟 reactiveを追加
import { useRoute, useRouter } from 'vue-router'; 

import AddPaymentModal from '@/components/AddPaymentModal.vue';
import ReceiptPaymentModal from '@/components/ReceiptPaymentModal.vue';
import InviteModal from '@/components/InviteModal.vue';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 統一モーダルを追加！
import PageHeader from '@/components/PageHeader.vue';
import GenreIcon from '@/components/GenreIcon.vue'; // 🌟 イベントのジャンルアイコン

// 🌟 どこからでも呼べる美しいアラートの準備
const alertState = reactive({ show: false, type: 'info', title: '', message: '', showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null });
const showAlert = (type, title, message) => {
  Object.assign(alertState, { type, title, message, showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, show: true });
};
// 🌟 はい／いいえ の確認ダイアログ（誤操作防止）
const showConfirm = (title, message, onConfirm, opts = {}) => {
  Object.assign(alertState, {
    type: opts.type || 'warning', title, message,
    showCancel: true, confirmText: opts.confirmText || 'はい', cancelText: opts.cancelText || 'いいえ',
    onConfirm, show: true,
  });
};
const handleAlertConfirm = () => {
  const cb = alertState.onConfirm;
  alertState.show = false;
  if (cb) cb();
};

// 🌟 自動で消えるトースト（コピー完了などの軽い通知用・モーダルより邪魔にならない）
const toastMsg = ref('');
let toastTimer = null;
const showToast = (msg) => {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 1800);
};

// 🌟 イベント作成後でも招待コードをコピーできるように
const copyInviteCode = async () => {
  const code = eventData.value.invitationCode;
  if (!code || code === '------') {
    showToast('コードを読み込み中です');
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    showToast('招待コードをコピーしました');
  } catch (e) {
    showToast('コピーに失敗しました');
  }
};

// 🌟 サーバー(Friend)と データベース(Main)の道具を合体！
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
// 🌟 修正：auth（ユーザー情報）を使えるように追加しました！
import { db, auth } from '../firebase'; 
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, deleteDoc, getDocs, where, arrayRemove, arrayUnion } from 'firebase/firestore';

// 🌟 あなたが作った最強の計算ツールを読み込む！
import { useSettlement } from '../composables/useSettlement';

// ==========================================
// 🌟 2. 初期設定・データ定義
// ==========================================
const route = useRoute();
const router = useRouter();
const timelineSection = ref(null);
// 🌟 自分の表示名は実データ（users/{uid}.name）から取得する
const myName = ref('');

const modals = ref({ participants: false, historyDetail: false, summaryDetail: false, unpaidWarning: false, addPayment: false, invite: false, editEvent: false });
const inviteUser = () => { modals.value.invite = true; };

// 🌟 イベント編集（名前・ジャンル）
const eventGenres = ['食事', '旅行', '遊び', '買い物', '飲み会', 'その他'];
const editName = ref('');
const editTag = ref('その他');
const openEditEvent = () => {
  editName.value = eventData.value.name === '読み込み中...' ? '' : eventData.value.name;
  editTag.value = eventData.value.tag || 'その他';
  modals.value.editEvent = true;
};
const saveEventEdit = async () => {
  const name = editName.value.trim();
  if (!name) { showAlert('error', '入力エラー', 'イベント名を入力してください。'); return; }
  const oldName = eventData.value.name;
  const oldTag = eventData.value.tag;
  try {
    await updateDoc(doc(db, 'events', route.params.id), { name, tag: editTag.value });
    // 🌟 変更を参加者へ通知（差分つき）
    const changes = [];
    if (oldName !== name) changes.push(`イベント名: ${oldName} → ${name}`);
    if ((oldTag || '') !== (editTag.value || '')) changes.push(`ジャンル: ${oldTag || 'なし'} → ${editTag.value}`);
    if (changes.length) {
      const uids = eventData.value.participants.map(p => p.id);
      await notifyParticipants(uids, { type: 'event_edited', eventName: name, changes: changes.join(' / ') });
    }
    modals.value.editEvent = false;
    showToast('イベントを更新しました');
  } catch (e) {
    console.error('イベント更新エラー:', e);
    showAlert('error', 'エラー', '更新に失敗しました。電波状況を確認してください。');
  }
};

// 🌟 参加者をイベントから外す（確認つき）
// 🌟 参加者一覧を開く（各参加者とのフレンド状態も読み込む）
const friendStatus = ref({}); // uid -> 'friend' | 'requested' | 'none'
const openParticipants = async () => {
  modals.value.participants = true;
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    const [friendsSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, 'users', myUid, 'friends')),
      getDocs(query(collection(db, 'friendRequests'), where('formId', '==', myUid), where('status', '==', 'pending'))),
    ]);
    const friends = new Set(friendsSnap.docs.map(d => d.id));
    const requested = new Set(reqSnap.docs.map(d => d.data().toId));
    const map = {};
    for (const p of eventData.value.participants) {
      if (p.isMe) continue;
      map[p.id] = friends.has(p.id) ? 'friend' : (requested.has(p.id) ? 'requested' : 'none');
    }
    friendStatus.value = map;
  } catch (e) { console.error('フレンド状態の取得エラー:', e); }
};

// 🌟 参加者にフレンド申請を送る
const sendFriendRequestTo = async (p) => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    let myPhoto = '';
    try { const md = await getDoc(doc(db, 'users', myUid)); if (md.exists()) myPhoto = md.data().photo || md.data().photoURL || ''; } catch (e) {}
    await addDoc(collection(db, 'friendRequests'), {
      toId: p.id,
      toName: p.name || '',
      formId: myUid,
      formName: myName.value || 'メンバー',
      formPhoto: myPhoto,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    friendStatus.value = { ...friendStatus.value, [p.id]: 'requested' };
    showToast(`${p.name}さんにフレンド申請を送りました`);
  } catch (e) {
    console.error('フレンド申請エラー:', e);
    showAlert('error', 'エラー', 'フレンド申請の送信に失敗しました。');
  }
};

const removeParticipant = (p) => {
  if (p.isMe) { showAlert('info', '外せません', '自分はイベントから外せません。'); return; }
  showConfirm('参加者を外す', `${p.name} さんをこのイベントから外しますか？`, async () => {
    try {
      await updateDoc(doc(db, 'events', route.params.id), { participants: arrayRemove(p.id) });
      showToast(`${p.name} さんを外しました`);
    } catch (e) {
      console.error('参加者削除エラー:', e);
      showAlert('error', 'エラー', '参加者を外せませんでした。');
    }
  }, { confirmText: '外す', cancelText: 'やめる' });
};
const selectedHistory = ref(null);
const selectedSummary = ref(null);

const eventData = ref({
  name: '読み込み中...',
  date: '---',
  total: 0, // 🌟 最初は 0
  invitationCode: '------',
  tag: 'その他', // 🌟 イベントのジャンル
  ended: false, // 🌟 終了済み（精算を締めた状態・削除とは別）
  participants: [],
  history: []
});

const sumFilterScope = ref('all'); 
const histFilterScope = ref('all'); 
const histSort = ref('new'); 
const sharedFilterStatus = ref('unpaid'); 

// ==========================================
// 🌟 3. あなたのスッキリ計算ロジック！
// ==========================================
const { calculatedSummary } = useSettlement(eventData, myName);

const filteredSummary = computed(() => {
  return calculatedSummary.value.filter(s => {
    const scopeMatch = sumFilterScope.value === 'all' || (s.from === myName.value || s.to === myName.value);
    const statusMatch = sharedFilterStatus.value === 'all' || s.status === sharedFilterStatus.value;
    return scopeMatch && statusMatch;
  });
});

const filteredHistory = computed(() => {
  let result = eventData.value.history.filter(h => {
    const scopeMatch = histFilterScope.value === 'all' || h.involvesMe || h.payer === myName.value;
    const statusMatch = sharedFilterStatus.value === 'all' || h.status === sharedFilterStatus.value;
    return scopeMatch && statusMatch;
  });
  return result.sort((a, b) => histSort.value === 'new' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
});

const unpaidItems = computed(() => eventData.value.history.filter(h => h.status === 'unpaid'));

// 🌟 未精算（まだ決済されていない）立替の合計
const outstandingTotal = computed(() =>
  eventData.value.history
    .filter(h => h.status === 'unpaid')
    .reduce((sum, h) => sum + (Number(h.amount) || 0), 0)
);

// 🌟 精算の進捗（何件中何件・何%）
const settlementProgress = computed(() => {
  const total = eventData.value.history.length;
  const done = eventData.value.history.filter(h => h.status === 'completed').length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
});

const scrollToTimeline = () => timelineSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
// 🌟 立替履歴の役割判定は「UID」で行う（名前一致のブレを避ける）
const isMyPayment = (h) => {
  const myUid = auth.currentUser?.uid;
  if (h.payerUid) return h.payerUid === myUid;
  return h.payer === myName.value; // 後方互換（payerUid 無しの古い履歴）
};
const myShareOf = (h) => {
  const myUid = auth.currentUser?.uid;
  let s = (h.shares || []).find((x) => x.uid === myUid);
  if (!s) s = (h.shares || []).find((x) => x.name === myName.value); // 後方互換
  return s ? (Number(s.amount) || 0) : 0;
};
// 🌟 立替者が受け取り待ちの額（全体 − 自分の取り分）
const myReceivableOf = (h) => (Number(h.amount) || 0) - myShareOf(h);

// 🌟 取引詳細を開くとき、閲覧者にとっての「金額・立場」を計算して渡す
const selectedMyAmount = ref(0);
const selectedMyRole = ref('none'); // 'payer'（受け取る側）/ 'debtor'（払う側）/ 'none'
const openHistoryDetail = (h) => {
  selectedHistory.value = h;
  const total = Number(h.amount) || 0;
  const myShare = myShareOf(h);
  if (isMyPayment(h)) {
    selectedMyRole.value = 'payer';
    selectedMyAmount.value = total - myShare; // 自分の取り分を除いた「受け取る額」
  } else if (myShare > 0) {
    selectedMyRole.value = 'debtor';
    selectedMyAmount.value = myShare;          // 自分が払う額
  } else {
    selectedMyRole.value = 'none';
    selectedMyAmount.value = total;
  }
  modals.value.historyDetail = true;
};
const openSummaryDetail = (s) => { selectedSummary.value = s; modals.value.summaryDetail = true; };

// 🌟 支払いの編集：詳細を閉じて、編集モードで支払いモーダルを開く
const editingHistory = ref(null);
const openNewPayment = () => { editingHistory.value = null; modals.value.addPayment = true; };
const openEditPayment = (h) => {
  editingHistory.value = h;
  modals.value.historyDetail = false;
  modals.value.addPayment = true;
};

// 🌟 支払いの変更を関係者（立替者＋負担者）へ通知（自分以外）
// 割り勘方法の表示ラベル（差分表示用）
const splitLabel = (t) => ({ all: '全員で均等', custom: '金額指定', item: '商品ごと' }[t] || t || 'なし');

// 🌟 変更を参加者（自分以外）へ通知する汎用ヘルパー
const notifyParticipants = async (uids, notifData) => {
  const myUid = auth.currentUser?.uid;
  const fromName = myName.value || auth.currentUser?.displayName || 'メンバー';
  const seen = new Set();
  for (const uid of uids) {
    if (!uid || uid === myUid || seen.has(uid)) continue;
    seen.add(uid);
    try {
      await addDoc(collection(db, "notifications"), {
        toUserId: uid,
        fromUserId: myUid || 'unknown',
        fromUserName: fromName,
        eventId: route.params.id,
        isRead: false,
        createdAt: serverTimestamp(),
        ...notifData, // type / itemName / amount / changes / eventName など
      });
    } catch (e) { console.error('通知作成エラー:', e); }
  }
};

// 🌟 支払いの削除（ゴミ箱へ控えを残してから削除／確認つき／関係者へ通知）
const deletePayment = (h) => {
  modals.value.historyDetail = false; // 詳細シートを先に閉じて、確認を1つだけにする
  showConfirm('支払いを削除', `「${h.itemName}」（¥${(Number(h.amount) || 0).toLocaleString()}）を削除しますか？\nゴミ箱に入り、7日以内なら元に戻せます。`, async () => {
    try {
      const eventId = route.params.id;
      const myUid = auth.currentUser?.uid;
      const involved = eventData.value.participants.map(p => p.id);
      // 削除前に取引の中身を控える（復元用）
      const txSnapshots = [];
      for (const tid of (h.transactionIds || [])) {
        try { const t = await getDoc(doc(db, "transactions", tid)); if (t.exists()) txSnapshots.push(t.data()); } catch (e) {}
      }
      // 🌟 共有ゴミ箱に控えを保存（両当事者が見られる・7日以内なら作り直して復元できる）
      let trashDocId = null;
      if (myUid) {
        try {
          const trashRef = await addDoc(collection(db, "trash"), {
            type: 'payment',
            participants: involved.includes(myUid) ? involved : [...involved, myUid], // 当事者全員が閲覧・操作可
            createdBy: myUid,
            createdByName: myName.value || 'メンバー',
            trashedAt: serverTimestamp(),
            status: 'trashed',
            eventId,
            eventName: eventData.value.name || 'イベント',
            itemName: h.itemName || '支払い',
            amount: Number(h.amount) || 0,
            historySnapshot: {
              payer: h.payer || '', payerUid: h.payerUid || null,
              itemName: h.itemName || '', splitType: h.splitType || 'all',
              amount: Number(h.amount) || 0, color: h.color || '#fca5a5',
              date: h.date || '', time: h.time || '',
              shares: h.shares || [], category: h.category || 'その他',
              items: h.items || [],
            },
            transactionSnapshots: txSnapshots,
          });
          trashDocId = trashRef.id;
        } catch (e) { console.error('ゴミ箱への控え保存に失敗:', e); }
      }
      // 実際に削除
      for (const tid of (h.transactionIds || [])) {
        try { await deleteDoc(doc(db, "transactions", tid)); } catch (e) { console.error(e); }
      }
      await deleteDoc(doc(db, "events", eventId, "history", h.id));
      await updateDoc(doc(db, "events", eventId), { totalAmount: increment(-(Number(h.amount) || 0)) });
      await notifyParticipants(involved, { type: 'payment_deleted', itemName: h.itemName, amount: Number(h.amount) || 0, eventName: eventData.value.name || '', trashId: trashDocId });
      modals.value.historyDetail = false;
      showToast('支払いをゴミ箱に移動しました');
    } catch (e) {
      console.error('支払い削除エラー:', e);
      showAlert('error', 'エラー', '支払いの削除に失敗しました。');
    }
  }, { confirmText: '削除', cancelText: 'やめる' });
};

// ==========================================
// 🌟 4. Firestore データベース操作
// ==========================================
// 決済完了の入口（詳細シートを閉じて、綺麗な確認を1つだけ出す）
const markAsCompleted = (id) => {
  modals.value.historyDetail = false;
  const hist = eventData.value.history.find(h => h.id === id);
  showConfirm(
    '決済を完了しますか？',
    `「${hist?.itemName || '決済'}」を完了として記録します。\n間違えた場合はゴミ箱から7日以内なら戻せます。`,
    () => doMarkAsCompleted(id),
    { confirmText: '完了する', cancelText: 'やめる' }
  );
};

const doMarkAsCompleted = async (id) => {
  try {
    const eventId = route.params.id || "test-event-1";
    const myUid = auth.currentUser?.uid;
    const hist = eventData.value.history.find(h => h.id === id);
    const txIds = hist?.transactionIds || [];
    // 🌟 紐づく取引(transactions)を完了にする（履歴/サマリーのstatusはここから導出される）
    for (const tid of txIds) {
      await updateDoc(doc(db, "transactions", tid), { status: 'completed' });
    }
    // 履歴ドキュメントのstatusもキャッシュとして更新
    await updateDoc(doc(db, "events", eventId, "history", id), { status: 'completed' });
    if (hist) hist.status = 'completed'; // ローカルにも即反映

    // 🗑️ 間違えて完了した時のために、7日間はゴミ箱から「未精算に戻す」ことができるようにする
    if (myUid && hist) {
      const others = [];
      const seen = new Set();
      const addOther = (uid, name) => {
        if (uid && uid !== myUid && !seen.has(uid)) { seen.add(uid); others.push({ uid, name: name || 'メンバー' }); }
      };
      if (hist.payerUid) addOther(hist.payerUid, hist.payer);
      (hist.shares || []).forEach(s => addOther(s.uid, s.name));
      try {
        await addDoc(collection(db, "trash"), {
          type: 'settlement',
          participants: [myUid, ...others.map(o => o.uid)], // 🌟 両当事者が見られる共有ゴミ箱
          createdBy: myUid,
          createdByName: myName.value || 'メンバー',
          trashedAt: serverTimestamp(),
          status: 'trashed',
          eventId,
          eventName: eventData.value.name || 'イベント',
          historyId: id,
          itemName: hist.itemName || '決済',
          amount: Number(hist.amount) || 0,
          transactionIds: txIds,
          counterparties: others,
        });
      } catch (e) { console.error('ゴミ箱への記録に失敗:', e); }
    }
    modals.value.historyDetail = false;
    showToast('決済を完了しました（ゴミ箱から7日以内なら戻せます）');
  } catch (error) {
    console.error("更新エラー:", error);
    showAlert('error', '更新エラー', '決済の更新に失敗しました。電波状況を確認してください。');
  }
};

// 🌟 ここが最大の修正ポイント！「共通の履歴」と「イベント内」の両方に保存します
const addHistory = async (newPayment) => {
  console.log("🚀 受信したデータ:", newPayment);
  // 🌟 終了済みイベントには新しい支払いを追加できない（記録の改変防止）
  if (eventData.value.ended) {
    showAlert('info', '終了済みのイベントです', 'このイベントは終了しています。新しい支払いの追加や編集はできません。');
    return;
  }
  try {
    const eventId = route.params.id || "test-event-1";
    const myUid = auth.currentUser?.uid;
    if (!myUid) throw new Error("ログインセッションが切れています");

    const totalAmount = Number(newPayment.amount);

    // 🌟 割り勘の対象者 = イベント本体の participants（UIDの配列）
    const participantUids = eventData.value.participants.map(p => p.id);
    if (participantUids.length === 0) {
      throw new Error("参加者情報がまだ読み込まれていません");
    }

    // 🌟 編集モード：先に古い支払い（transactions/history/合計）を消してから作り直す
    let oldPay = null;
    if (newPayment.editId) {
      const old = eventData.value.history.find(h => h.id === newPayment.editId);
      if (old) {
        // 差分表示のために編集前の値を控えておく
        oldPay = { amount: old.amount, itemName: old.itemName, category: old.category, payer: old.payer, splitType: old.splitType };
        for (const tid of (old.transactionIds || [])) {
          try { await deleteDoc(doc(db, "transactions", tid)); } catch (e) { console.error(e); }
        }
        try { await deleteDoc(doc(db, "events", eventId, "history", old.id)); } catch (e) { console.error(e); }
        try { await updateDoc(doc(db, "events", eventId), { totalAmount: increment(-(Number(old.amount) || 0)) }); } catch (e) { console.error(e); }
      }
    }

    // 🌟 立替者（債権者）＝モーダルで選ばれた人のUID（無ければ自分）
    const creditorUid = (newPayment.payerUid && participantUids.includes(newPayment.payerUid))
      ? newPayment.payerUid
      : myUid;

    // 🌟 割り勘方法に応じた「各メンバーの負担額」（モーダルが算出して渡す）
    //    後方互換：shares が無い古い呼び出しは均等割りにフォールバック
    let shares = Array.isArray(newPayment.shares) ? newPayment.shares : null;
    if (!shares) {
      const per = Math.floor(totalAmount / (participantUids.length || 1));
      shares = participantUids.map((uid) => ({ uid, name: '', amount: per }));
    }

    // 🌟 1. 立替者以外の「負担した人」ごとに、指定額どおりの transactions を生成
    //       （HomeView/MoneyPage が読む正データ。均等割りはしない）
    const transactionIds = [];
    for (const s of shares) {
      if (!s || s.uid === creditorUid) continue;   // 立替者自身は自己負担なので作らない
      const amt = Number(s.amount) || 0;
      if (amt <= 0) continue;                       // 0円・未入力はスキップ
      const txRef = await addDoc(collection(db, "transactions"), {
        paidById: s.uid,            // 債務者（払う人）
        paidToId: creditorUid,      // 債権者（立て替えた人）
        amount: amt,
        status: "unpaid",
        eventId: eventId,
        itemName: newPayment.itemName,
        createdAt: serverTimestamp(),
      });
      transactionIds.push(txRef.id);
    }

    // 🌟 2. このイベント内の「立て替え履歴」サブコレクションへ保存
    const historyRef = collection(db, "events", eventId, "history");
    const docRef = await addDoc(historyRef, {
      payer: newPayment.payer,
      payerUid: creditorUid, // 🌟 立替者のUID（役割判定を名前でなくUIDで行う）
      itemName: newPayment.itemName,
      category: newPayment.category || 'その他', // 🌟 支払いジャンル
      registrationNumber: newPayment.registrationNumber || null, // 🌟 事業者登録番号（インボイス）
      splitType: newPayment.splitType,
      taxMode: newPayment.taxMode || 'included', // 🌟 税の計算方法（再編集時に復元）
      remainder: newPayment.remainder || null, // 🌟 不明な残金（差額の負担者＋理由）
      amount: Number(newPayment.amount),
      date: newPayment.date,
      time: newPayment.time,
      status: 'unpaid',
      timestamp: serverTimestamp(), // 並び替えに使用
      shares: newPayment.shares || [], // 🌟 各メンバーの負担額（精算サマリーの正データ）
      items: newPayment.items || [],
      transactionIds: transactionIds // 🌟 決済完了時に transactions 側も更新するための紐付け（A-7で使用）
    });

    // 🌟 3. イベント本体の合計金額(totalAmount)を更新
    const eventDocRef = doc(db, "events", eventId);
    await updateDoc(eventDocRef, {
      totalAmount: increment(Number(newPayment.amount))
    });

    // 🌟 編集なら参加者全員（自分以外）に「編集された」通知を送る（変更内容の差分つき）
    if (newPayment.editId) {
      const changes = [];
      if (oldPay) {
        const yen = (v) => `¥${(Number(v) || 0).toLocaleString()}`;
        if (Number(oldPay.amount) !== Number(newPayment.amount)) changes.push(`金額: ${yen(oldPay.amount)} → ${yen(newPayment.amount)}`);
        if ((oldPay.itemName || '') !== (newPayment.itemName || '')) changes.push(`内容: ${oldPay.itemName || 'なし'} → ${newPayment.itemName || 'なし'}`);
        if ((oldPay.category || '') !== (newPayment.category || '')) changes.push(`ジャンル: ${oldPay.category || 'なし'} → ${newPayment.category || 'なし'}`);
        if ((oldPay.payer || '') !== (newPayment.payer || '')) changes.push(`立替者: ${oldPay.payer || 'なし'} → ${newPayment.payer || 'なし'}`);
        if ((oldPay.splitType || '') !== (newPayment.splitType || '')) changes.push(`割り勘: ${splitLabel(oldPay.splitType)} → ${splitLabel(newPayment.splitType)}`);
      }
      await notifyParticipants(participantUids, {
        type: 'payment_edited',
        itemName: newPayment.itemName || '',
        amount: Number(newPayment.amount) || 0,
        changes: changes.length ? changes.join(' / ') : '内容を更新しました',
      });
    }

    console.log("✅ 全ての保存が完了しました ID:", docRef.id);
    modals.value.addPayment = false;
    
    // 保存後にタイムラインへスクロール
    setTimeout(scrollToTimeline, 300);
  } catch (error) {
    console.error("❌ 保存失敗:", error);
    showAlert('error', '保存エラー', 'データの保存に失敗しました。');
  }
};

// リアルタイム監視
// Firestore リスナーの購読解除用（onUnmounted / 削除時に解除）
let unsubEvent = null;
let unsubHistory = null;

onMounted(async () => {
  // 🌟 自分の表示名を取得（精算サマリーの「自分」判定・フィルタに使用）
  const me = auth.currentUser;
  if (me) {
    try {
      const md = await getDoc(doc(db, "users", me.uid));
      myName.value = (md.exists() && md.data().name) ? md.data().name : (me.displayName || '自分');
    } catch (e) { myName.value = me.displayName || '自分'; }
  }

  const eventId = route.params.id;
  if (!eventId) return;

  // --- A. イベント本体の情報を監視 (名前や招待コード) ---
  unsubEvent = onSnapshot(doc(db, "events", eventId), async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      eventData.value.name = data.name;
      eventData.value.tag = data.tag || 'その他';
      eventData.value.ended = !!data.ended; // 🌟 終了済みフラグ
      eventData.value.invitationCode = data.invitationCode || "------";

      // 参加者情報の取得（名前＋アイコンを実データから）
      const uids = data.participants || [];
      const detailed = await Promise.all(uids.map(async (uid) => {
        const info = await getUserInfo(uid);
        return { id: uid, name: info.name, color: info.icon, isMe: uid === auth.currentUser?.uid };
      }));
      eventData.value.participants = detailed;
    }
  }, (err) => {
    // イベント削除後や参加者でない場合は静かに無視（未購読解除の残骸対策）
    if (err?.code !== 'permission-denied') console.error("イベント監視エラー:", err);
  });

  // --- B. 立て替え履歴(history)サブコレクションを監視 ---
  const historyRef = collection(db, "events", eventId, "history");
  // 🌟 timestamp（作成日時）の降順（新しい順）で取得
  const q = query(historyRef, orderBy("timestamp", "desc"));

  unsubHistory = onSnapshot(q, async (snapshot) => {
    // 🌟 このイベントの取引(transactions)のstatusマップを作り、履歴のstatusを導出する
    //    （transactionsを唯一の正データとし、決済完了を履歴/サマリーに反映）
    const txStatus = {};
    try {
      const txSnap = await getDocs(query(collection(db, "transactions"), where("eventId", "==", eventId)));
      txSnap.forEach((d) => { txStatus[d.id] = d.data().status || 'unpaid'; });
    } catch (e) { console.error("取引status取得エラー:", e); }

    const fetchedHistory = [];
    snapshot.forEach((docu) => {
      const data = docu.data();
      const txIds = data.transactionIds || [];
      // イベント表示は「未払い / 完了」の二値（承認待ちは未払い側に含める）。
      // useSettlement が unpaid/completed のみ扱うため、ここも二値に揃える。
      let derivedStatus;
      if (txIds.length === 0) {
        derivedStatus = 'completed'; // 債務者なし＝精算対象なし＝完了扱い
      } else {
        const allDone = txIds.every((tid) => txStatus[tid] === 'completed');
        derivedStatus = allDone ? 'completed' : 'unpaid';
      }
      fetchedHistory.push({
        id: docu.id,
        payer: data.payer,
        itemName: data.itemName,
        splitType: data.splitType,
        amount: data.amount,
        color: data.color || '#fca5a5',
        date: data.date,
        time: data.time,
        status: derivedStatus,
        transactionIds: txIds,
        timestamp: data.timestamp ? data.timestamp.toMillis() : Date.now(),
        shares: data.shares || [],
        payerUid: data.payerUid || null,
        category: data.category || 'その他',
        registrationNumber: data.registrationNumber || null,
        taxMode: data.taxMode || 'included',
        remainder: data.remainder || null,
        items: data.items || []
      });
    });

    // 🌟 これで画面の「立て替え履歴」リストが自動更新される
    eventData.value.history = fetchedHistory;

    // 🌟 合計金額も履歴から再計算して反映
    eventData.value.total = fetchedHistory.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, (err) => {
    // イベント削除後や参加者でない場合は静かに無視（未購読解除の残骸対策）
    if (err?.code !== 'permission-denied') console.error("履歴監視エラー:", err);
  });
});

// リスナーの購読解除（画面離脱・イベント削除時のリーク／権限エラー防止）
const unsubscribeAll = () => {
  if (unsubEvent) { unsubEvent(); unsubEvent = null; }
  if (unsubHistory) { unsubHistory(); unsubHistory = null; }
};
onUnmounted(unsubscribeAll);

const goToBatchPayment = (summary) => {
  modals.value.summaryDetail = false;
  const eventId = eventData.value.id || 1;
  
  if (summary.isMePayer) {
    router.push(`/payment-detail/event-unpaid-${eventId}`);
  } else {
    router.push(`/payment-detail/event-waiting-${eventId}`);
  }
};

const deleteEventCompletely = async () => {
  const eventId = route.params.id;
  const myUid = auth.currentUser?.uid;
  if (!eventId || !myUid) { router.push('/'); return; }
  // 画面を離れるのでリスナーを解除
  unsubscribeAll();
  try {
    // 相手のイベントは消さず、自分の画面からだけ隠す（hiddenBy に自分を追加）
    await updateDoc(doc(db, "events", eventId), { hiddenBy: arrayUnion(myUid) });
    // ゴミ箱に入れる（7日以内なら復元できる）
    const evTrashRef = await addDoc(collection(db, "users", myUid, "trash"), {
      type: 'event',
      eventId,
      eventName: eventData.value.name || 'イベント',
      eventTag: eventData.value.tag || 'その他',
      trashedAt: serverTimestamp(),
      status: 'trashed',
    });
    // 🌟 一方的な削除にならないよう、他の参加者へ「抜けました。正しいですか？」を届ける
    const others = eventData.value.participants.map(p => p.id).filter(uid => uid !== myUid);
    for (const uid of others) {
      try {
        await addDoc(collection(db, "notifications"), {
          toUserId: uid, type: 'event_left_check',
          eventId, eventName: eventData.value.name || 'イベント',
          trashId: evTrashRef.id,
          fromUserId: myUid, fromUserName: myName.value || 'メンバー',
          isRead: false, createdAt: serverTimestamp(),
        });
      } catch (e) {}
    }
  } catch (e) {
    console.error("イベント削除エラー:", e);
  }
  router.push('/');
};

// 🌟 イベントの「終了」＝全員の精算を締める（削除はしない・記録として残る）
const handleEndEvent = () => {
  // 未精算が残っていたら、まず精算へ誘導（終了は精算完了が条件）
  if (unpaidItems.value.length > 0) { modals.value.unpaidWarning = true; return; }
  showConfirm(
    'イベントを終了しますか？',
    '精算はすべて完了しています。終了すると記録として残り、参加者全員の画面で「終了済み」になります。',
    async () => {
      try {
        await updateDoc(doc(db, 'events', route.params.id), { ended: true, endedAt: serverTimestamp() });
        eventData.value.ended = true;
        showToast('イベントを終了しました');
      } catch (e) {
        console.error('イベント終了エラー:', e);
        showAlert('error', 'エラー', 'イベントの終了に失敗しました。');
      }
    },
    { type: 'warning', confirmText: '終了する', cancelText: 'やめる' }
  );
};

// 🌟 イベントの「削除」＝自分の画面から非表示（ゴミ箱に入り7日以内は復元可）
const handleDeleteEvent = () => {
  showConfirm(
    'イベントを削除しますか？',
    'このイベントを自分の画面から削除します。ゴミ箱に入り、7日以内なら復元できます（相手の画面には残ります）。',
    () => deleteEventCompletely(),
    { type: 'error', confirmText: '削除する', cancelText: 'やめる' }
  );
};

// ==========================================
// 🌟 5. お友達（Friend）のクラウド精算呼び出し！
// ==========================================
const settlementTransfers = ref([]); 

const fetchSettlement = async () => {
  try {
    console.log("精算計算をリクエスト中...");
    const calcFunc = httpsCallable(functions, 'calculateSettlement');
    const response = await calcFunc({ eventId: route.params.id });
    console.log("🎉 精算結果が返ってきました！", response.data);
    settlementTransfers.value = response.data.transfers;
  } catch (error) {
    console.error("❌ 精算計算エラー:", error);
  }
};

onMounted(() => {
  if (route.params.id) {
    fetchSettlement();
  }
});
</script>

<style scoped>
.event-detail-container { 
  background-color: var(--c-bg);
  display: flex;
  flex-direction: column;
  font-family: var(--font-sans);
  box-sizing: border-box;
}

.detail-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 16px 20px; /* 🌟 少し余白をリッチに */
  background: linear-gradient(135deg, #dcfce7 0%, #e0f2fe 100%); /* 🌟 爽やかなグラデーションに！ */
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  position: sticky; 
  z-index: 100; 
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  margin-bottom: 10px;
}


.back-btn { background: none; border: none; font-size: 32px; color: var(--c-ink); cursor: pointer; padding: 0; display: flex; align-items: center; transition: 0.2s; }
.back-btn:active { transform: scale(0.9); }
.title { font-size: 18px; font-weight: 800; margin: 0; color: var(--c-ink); letter-spacing: 0.5px; }

/* 🌟 コンテンツ全体の余白とカードの洗練 */
.content { padding: 15px 20px 20px; flex: 1; padding-bottom: 120px; }

.summary-card { background: white; border-radius: 28px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); margin-bottom: 32px; border: 1px solid var(--c-surface-2); }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; gap: 12px; }
.event-title-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.event-genre { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--c-brand-weak); border-radius: 12px; color: var(--c-brand); }
.event-genre :deep(svg) { width: 22px; height: 22px; }
.event-name { font-size: 22px; font-weight: 900; margin: 0; color: var(--c-ink); letter-spacing: -0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-date { font-size: 12px; color: var(--c-brand); font-weight: 800; background: #eff6ff; padding: 6px 12px; border-radius: 12px; }
.event-edit-btn { flex-shrink: 0; font-size: 12px; font-weight: 800; color: var(--c-brand-strong, var(--c-brand)); background: var(--c-brand-weak); border: none; padding: 8px 16px; border-radius: 12px; cursor: pointer; transition: 0.2s; }
.event-edit-btn:active { transform: scale(0.95); }

.total-section { text-align: center; margin-bottom: 24px; background: var(--c-surface-2); padding: 20px; border-radius: 20px; }
.label { font-size: 13px; color: var(--c-text-sub); font-weight: 800; display: flex; justify-content: center; align-items: center; margin-bottom: 8px; }
.total-amount { font-size: 48px; font-weight: 900; margin: 0; color: var(--c-ink); letter-spacing: -1.5px; }
.total-sub { display: block; font-size: 12px; font-weight: 800; color: var(--c-text-faint); margin-top: 6px; }
.progress-wrap { margin-top: 14px; }
.progress-bar { height: 8px; background: var(--c-line-bold); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-brand); border-radius: 999px; transition: width 0.4s ease; }
.progress-text { display: block; font-size: 11px; font-weight: 800; color: var(--c-text-sub); margin-top: 6px; }

/* （これ以降のCSSは既存のままでOKです） */

.participants-section { background: var(--c-surface-2); padding: 16px; border-radius: 20px; cursor: pointer; transition: 0.2s; border: 1px solid var(--c-surface-2); }
.participants-section:active { background: var(--c-surface-2); }
.participants-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.participants-header .label { margin: 0; color: var(--c-text-strong); }
.participants-header .arrow { color: var(--c-line-strong); font-weight: bold; font-size: 16px; }
.participants-row { display: flex; justify-content: space-between; align-items: center; }
.avatar-stack { display: flex; align-items: center; padding-left: 14px; }
/* 🌟 丸い枠＋overflow:hidden で画像を切り抜く（縦長に歪まない）。少し大きく＆重ねる */
.avatar {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 3px solid #fff;
  margin-left: -14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  overflow: hidden;
  flex-shrink: 0;
  box-sizing: border-box;
  background: var(--c-line-bold);
}
.avatar__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar__ph { width: 100%; height: 100%; }
.avatar-more {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 3px solid #fff;
  margin-left: -14px;
  background: var(--c-line-bold); color: var(--c-text-sub);
  font-size: 13px; font-weight: bold;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-sizing: border-box;
  z-index: 0;
}
.invite-pill-btn { background: #eff6ff; color: var(--c-brand); border: none; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 800; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(5,150,105,0.15); }
.invite-pill-btn:active { transform: scale(0.95); background: #dbeafe; }

/* 🌟 招待コード（作成後もいつでも表示・コピー可能） */
.invite-code-bar {
  display: flex; align-items: center; gap: 10px;
  margin-top: 14px;
  background: var(--c-brand-weak);
  border: 1px solid var(--c-brand-weak, var(--c-brand-tint));
  border-radius: 16px;
  padding: 12px 14px;
}
.icb-label { font-size: 12px; font-weight: 800; color: var(--c-brand-strong, var(--c-brand)); white-space: nowrap; }
.icb-code { flex: 1; font-size: 20px; font-weight: 900; letter-spacing: 3px; color: var(--c-ink); text-align: center; font-variant-numeric: tabular-nums; }
.icb-copy { background: var(--c-brand); color: #fff; border: none; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; white-space: nowrap; }
.icb-copy:active { transform: scale(0.95); }

.section-title { font-size: 18px; font-weight: 900; color: var(--c-ink); margin: 0 0 16px 0; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.add-payment-btn { background: var(--c-brand); color: white; border: none; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.25); transition: 0.2s; }
.add-payment-btn:active { transform: scale(0.95); }
.settlement-summary-section, .history-section { margin-bottom: 36px; }

.filter-wrapper { display: flex; gap: 10px; margin-bottom: 20px; }
.ios-segmented-control { display: flex; flex: 1; background: var(--c-line-bold); border-radius: 12px; padding: 3px; }
.ios-segmented-control button { flex: 1; padding: 8px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: var(--c-text-sub); border-radius: 10px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.ios-segmented-control button.active { background: white; color: var(--c-ink); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.custom-select-wrapper { flex: 1; position: relative; }
.custom-select-wrapper.auto-width { flex: 0.6; }
.ios-select { width: 100%; padding: 0 12px; border-radius: 12px; border: 1px solid var(--c-line-strong); background: white; font-size: 12px; font-weight: 800; color: var(--c-text); outline: none; height: 100%; min-height: 36px; appearance: none; -webkit-appearance: none; cursor: pointer; }
.custom-select-wrapper::after { content: '▾'; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--c-text-faint); pointer-events: none; }

.summary-list, .timeline { display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; font-size: 13px; color: var(--c-text-faint); font-weight: 800; padding: 30px; background: white; border-radius: 20px; border: 2px dashed var(--c-line-bold); }
.summary-card-item { background: white; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; box-shadow: var(--shadow-card); cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
.summary-card-item:active { transform: scale(0.98); border-color: var(--c-line); }
.flow { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
.avatar-small { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; }
.name { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text); max-width: 64px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arrow-right { color: var(--c-text-faint); font-size: 12px; font-weight: bold; flex-shrink: 0; }
.amount-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.amount { font-size: 18px; font-weight: 900; display: flex; align-items: center; gap: 6px; }
.blue-text { color: var(--c-receive); } .orange-text { color: var(--c-pay); }
.arrow-icon { font-size: 16px; color: var(--c-line-strong); }

.timeline { position: relative; padding-left: 12px; }
.timeline-item { position: relative; margin-bottom: 16px; cursor: pointer; display: flex; align-items: stretch; }
.timeline-line { position: absolute; left: 6px; top: 24px; bottom: -16px; width: 2px; background-color: var(--c-line-bold); z-index: 1; }
.timeline-item:last-child .timeline-line { display: none; }
.timeline-dot { position: absolute; left: 0; top: 20px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #f4f7f9; z-index: 2; box-shadow: 0 0 0 1px var(--c-line-bold); }
.timeline-content { padding-left: 28px; flex: 1; }

.history-card { background: white; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: 0.2s; border: 1px solid transparent; }
.history-card:active { transform: scale(0.98); }
.unpaid-card { border: 1px solid #fca5a5; background: #fff5f5; box-shadow: 0 4px 12px rgba(239,68,68,0.05); }

/* 🌟 差し替える部分（レイアウト崩れ防止） */
.history-main { 
  display: flex; 
  align-items: center; 
  gap: 14px; 
  flex: 1; /* 右側の余白をしっかり確保する */
  min-width: 0; /* 子要素がはみ出すのを防ぐ魔法のコード */
}
.history-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  flex-shrink: 0; /* アバターが潰れないようにする */
}
/* 🌟 ジャンルアイコン表示用 */
.history-avatar--cat {
  background: var(--c-brand-weak);
  color: var(--c-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}
.history-avatar--cat :deep(svg) { width: 20px; height: 20px; }
.history-text { 
  display: flex; 
  flex-direction: column; 
  gap: 2px; 
  min-width: 0; /* 長いテキストのはみ出し防止 */
  width: 100%;
}
.history-item-name { 
  font-size: 15px; 
  font-weight: 900; 
  color: var(--c-ink); 
  white-space: nowrap; /* 折り返さない */
  overflow: hidden; /* はみ出た部分を隠す */
  text-overflow: ellipsis; /* ...で省略する */
  display: flex;
  align-items: center;
}
.split-type { 
  font-size: 10px; 
  color: var(--c-text-sub); 
  font-weight: 700; 
  background: var(--c-surface-2); 
  padding: 2px 6px; 
  border-radius: 6px; 
  margin-left: 6px; 
  flex-shrink: 0; /* バッジが潰れないようにする */
}
.history-right { 
  display: flex; 
  flex-direction: column; 
  align-items: flex-end; 
  gap: 6px; 
  flex-shrink: 0; /* 金額やボタンが潰れないようにする */
  margin-left: 12px; /* 左のテキストとの間隔を確保 */
}
.split-type { font-size: 10px; color: var(--c-text-sub); font-weight: 700; background: var(--c-surface-2); padding: 2px 6px; border-radius: 6px; margin-left: 4px; vertical-align: middle; }
.history-payer { font-size: 11px; color: var(--c-text-sub); font-weight: 700; }
.history-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.history-price { font-size: 18px; font-weight: 900; color: var(--c-ink); letter-spacing: -0.5px; }
.pay-now-btn { background: var(--c-danger); color: white; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 8px rgba(239,68,68,0.2); transition: 0.2s; }
.pay-now-btn:active { transform: scale(0.95); }

.badge { font-size: 10px; padding: 4px 10px; border-radius: 12px; font-weight: 800; }
.paid { background: var(--c-surface-2); color: var(--c-text-sub); }
.badge.receive { background: var(--c-brand-weak); color: var(--c-brand-strong, var(--c-brand)); }
.badge.owe { background: #fff7ed; color: #ea580c; }
.badge.pending { background: var(--c-surface-2); color: var(--c-text-faint); }

.end-event-btn { width: 100%; background-color: var(--c-ink); color: white; border: none; padding: 18px; border-radius: 20px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(0,0,0,0.15); transition: 0.2s; margin-bottom: 12px; }
.end-event-btn:active { transform: scale(0.96); }
.end-hint { font-size: 11px; color: var(--c-text-faint); text-align: center; margin: 0 0 18px; font-weight: 700; }

/* 🌟 削除（ゴミ箱行き）は終了と明確に区別 */
.delete-event-btn { width: 100%; background: #fff; color: var(--c-danger-strong); border: 1.5px solid #fecaca; padding: 16px; border-radius: 20px; font-size: 15px; font-weight: 900; cursor: pointer; transition: 0.2s; margin-bottom: 12px; }
.delete-event-btn:active { transform: scale(0.96); background: var(--c-danger-weak); }

/* 🌟 終了済み表示 */
.ended-chip { width: 100%; background: var(--c-brand-weak); color: var(--c-brand); border: 1.5px solid #a7f3d0; padding: 14px; border-radius: 16px; font-size: 13px; font-weight: 800; text-align: center; margin-bottom: 18px; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--c-overlay); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
.modal-content { background: white; width: 100%; max-width: 600px; border-radius: 32px 32px 0 0; padding: 30px 25px; box-sizing: border-box; max-height: 85vh; overflow-y: auto; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.modal-header h3 { margin: 0; font-size: 20px; color: var(--c-ink); font-weight: 900; }
.close-btn { background: var(--c-surface-2); border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 20px; color: var(--c-text-sub); cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }

.list-item { display: flex; align-items: center; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--c-surface-2); }
.avatar-medium { width: 44px; height: 44px; border-radius: 50%; }
.item-name { flex: 1; font-size: 16px; font-weight: 800; color: var(--c-text); display: flex; align-items: center; gap: 10px; }
.p-friend-btn { background: var(--c-brand); color: #fff; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; border: none; flex-shrink: 0; }
.p-friend-btn:active { transform: scale(0.95); }
.p-friend-tag { background: var(--c-brand-weak); color: var(--c-brand); padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; flex-shrink: 0; }
.p-friend-tag.is-wait { background: #fffbeb; color: #b45309; }
.me-badge { font-size: 10px; background: var(--c-brand); color: white; padding: 2px 8px; border-radius: 10px; font-weight: 800; }
.p-remove-btn { flex-shrink: 0; width: 34px; height: 34px; border: none; background: var(--c-danger-weak); color: var(--c-danger); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.p-remove-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.p-remove-btn:active { transform: scale(0.92); }

/* 🌟 イベント編集モーダル */
.edit-body { display: flex; flex-direction: column; }
.edit-label { font-size: 12px; font-weight: 800; color: var(--c-text-sub); margin-bottom: 8px; }
.edit-input { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--c-line-bold); background: var(--c-surface-2); font-size: 15px; font-weight: 800; color: var(--c-ink); outline: none; box-sizing: border-box; margin-bottom: 20px; }
.edit-input:focus { border-color: var(--c-brand); background: #fff; }
.edit-genre-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
.edit-genre { background: var(--c-surface-2); border: 1.5px solid var(--c-line-bold); border-radius: 16px; padding: 14px 4px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--c-text-sub); cursor: pointer; transition: 0.15s; }
.edit-genre:active { transform: scale(0.96); }
.edit-genre-icon { width: 24px; height: 24px; color: var(--c-text-sub); }
.edit-genre-label { font-size: 12px; font-weight: 800; }
.edit-genre.active { border-color: var(--c-brand); background: var(--c-brand-weak); color: var(--c-brand-strong); }
.edit-genre.active .edit-genre-icon { color: var(--c-brand); }
.edit-save-btn { width: 100%; background: var(--c-brand); color: #fff; border: none; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(5,150,105,0.25); transition: 0.2s; }
.edit-save-btn:active { transform: scale(0.97); }

.summary-detail-body { text-align: center; padding: 10px 0; }
.flow-large { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px; }
.avatar-large { width: 64px; height: 64px; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.arrow-large { font-size: 24px; color: var(--c-line-strong); font-weight: bold; }
.s-text { font-size: 16px; color: var(--c-text-strong); line-height: 1.6; margin-bottom: 16px; font-weight: 700; }
.s-amount { font-size: 48px; font-weight: 900; margin: 0 0 10px; letter-spacing: -1.5px; }
.s-hint { font-size: 14px; color: var(--c-text-faint); margin-bottom: 32px; font-weight: 700; }
.action-btn { width: 100%; padding: 18px; border-radius: 20px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
.action-btn.main { background: var(--c-brand); color: white; box-shadow: 0 8px 20px rgba(5,150,105,0.25); }
.action-btn.main:active { transform: scale(0.96); }

.warning-modal { background: var(--c-danger-weak); }
.warning-title { color: var(--c-danger) !important; }
.warning-desc { font-size: 15px; color: var(--c-text-strong); font-weight: 800; margin-bottom: 24px; line-height: 1.6; }
.warning-actions { display: flex; flex-direction: column; gap: 12px; }
.danger-btn { background: var(--c-danger); color: white; border: none; padding: 18px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 8px 20px rgba(239,68,68,0.25); }
.safe-btn { background: white; color: var(--c-text-strong); border: 2px solid var(--c-line-strong); padding: 16px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; }

.completed-section { margin-top: 20px; margin-bottom: 20px; }
.completed-card { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; text-align: center; color: #166534; box-shadow: 0 4px 10px rgba(0,0,0,0.02); }
.completed-icon { font-size: 32px; display: block; margin-bottom: 8px; }
.completed-title { font-size: 15px; font-weight: 900; margin: 0; }

.slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

/* 🌟 自動で消えるトースト */
.settlo-toast {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translate(-50%, 0);
  background: rgba(15, 23, 42, 0.92);
  color: #fff;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  z-index: 3000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translate(-50%, 12px); }

/* 🌟 追加：サマリー内訳のスタイル */
.breakdown-list {
  background: var(--c-surface-2);
  border-radius: 16px;
  padding: 16px;
  margin: 20px 0;
  text-align: left;
  border: 1px solid var(--c-line-bold);
}
.breakdown-title {
  font-size: 12px;
  color: var(--c-text-sub);
  margin: 0 0 12px 0;
  font-weight: 800;
  border-bottom: 1px dashed var(--c-line-strong);
  padding-bottom: 8px;
}
.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.breakdown-item:last-child {
  margin-bottom: 0;
}
.bd-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--c-text);
}
.bd-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.bd-who {
  font-size: 10px;
  color: var(--c-text-faint);
  font-weight: 800;
  background: var(--c-surface-2);
  padding: 2px 6px;
  border-radius: 6px;
}
.bd-amount {
  font-size: 15px;
  font-weight: 900;
  color: var(--c-ink);
}
.avatar,
.avatar-medium,
.avatar-large,
.history-avatar,
.avatar-small {
  object-fit: cover;       /* 🌟 画像を枠に合わせて切り抜く（縦横比を保つ） */
  border-radius: 50%;      /* 確実に円形にする */
  flex-shrink: 0;          /* 🌟 flex内で潰れて楕円になるのを防ぐ */
  box-sizing: border-box;  /* borderで寸法が狂わないように */
  aspect-ratio: 1 / 1;     /* 🌟 常に正円を維持 */
}
</style>