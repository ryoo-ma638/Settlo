<template>
  <div class="event-detail-container">
    <PageHeader :title="eventData.name || 'イベント詳細'" class="event-page-header">
      <template #right>
        <button class="event-edit-btn" @click="openEditEvent">編集</button>
      </template>
    </PageHeader>

    <main class="content">
      <div class="summary-card">
        <div class="total-section clickable" @click="scrollToTimeline">
          <span class="label"><span class="event-genre"><GenreIcon :type="eventData.tag" /></span>未精算の残り <span class="arrow-down">履歴を見る ↓</span></span>
          <h1 class="total-amount">¥{{ outstandingTotal.toLocaleString() }}</h1>
          <span class="total-sub">立替の合計 ¥{{ eventData.total.toLocaleString() }}</span>

          <div class="progress-wrap" v-if="settlementProgress.total > 0">
            <div class="progress-bar"><div class="progress-fill" :style="{ width: settlementProgress.percent + '%' }"></div></div>
            <span class="progress-text">{{ settlementProgress.done }}/{{ settlementProgress.total }}件 精算済み（{{ settlementProgress.percent }}%）</span>
          </div>
        </div>
      </div>

      <section class="settlement-summary-section" data-tour="ev-summary">
        <div class="section-header settlement-heading-row">
          <div class="settlement-title-line">
            <h3 class="section-title" ref="summaryHeading" tabindex="-1">まとめて精算</h3>
            <button
              v-if="canStartNetSettlement"
              class="start-settlement-btn"
              :disabled="settlementBusy"
              @click="startNetSettlement"
            >{{ settlementBusy ? '作成中…' : '精算を始める' }}</button>
            <button
              v-else-if="canRefreshNetSettlement"
              class="start-settlement-btn refresh"
              :disabled="settlementBusy"
              @click="refreshNetSettlement"
            >{{ settlementBusy ? '更新中…' : '追加分を反映' }}</button>
          </div>
          <p class="section-note">全員分の貸し借りをまとめ、支払い回数を減らした結果です。</p>
          <p v-if="hasUnresolvedSettlementReview" class="settlement-error">
            受取を確認できなかった支払いがあります。追加分を反映する前に、該当する行から送金状況を確認してください。
          </p>
          <div class="settlement-filters" role="group" aria-label="まとめて精算の表示状態">
            <button type="button" :class="{ active: settlementFilter === 'all' }" @click="settlementFilter = 'all'">すべて</button>
            <button type="button" :class="{ active: settlementFilter === 'unpaid' }" @click="settlementFilter = 'unpaid'">未精算</button>
            <button type="button" :class="{ active: settlementFilter === 'completed' }" @click="settlementFilter = 'completed'">精算済み</button>
          </div>
        </div>

        <div v-if="netSettlementError" class="settlement-error">{{ netSettlementError }}</div>
        <div class="summary-list">
          <div v-if="!netSettlementError && filteredNetSettlementRows.length === 0" class="empty-state">
            {{ settlementEmptyText }}
          </div>
          <button
            class="summary-card-item"
            :class="{ completed: sum.status === 'completed' }"
            v-for="sum in filteredNetSettlementRows"
            :key="sum.id"
            type="button"
            @click="openSummaryDetail(sum)"
          >
            <span class="flow">
              <UserAvatar class="avatar-small" :name="sum.from" :photo="sum.fromPhoto" :size="24" />
              <span class="name">{{ sum.from }}</span>
              <span class="arrow-right">→</span>
              <UserAvatar class="avatar-small" :name="sum.to" :photo="sum.toPhoto" :size="24" />
              <span class="name">{{ sum.to }}</span>
            </span>
            <span class="amount-right">
              <span v-if="sum.status === 'completed'" class="badge paid">確定</span>
              <span v-else-if="sum.status === 'awaiting_approval'" class="badge waiting">受取確認待ち</span>
              <span v-else-if="sum.reviewRequired" class="badge owe">要再確認</span>
              <span v-else-if="sum.isPreview" class="badge preview">計算結果</span>
              <span v-else-if="sum.isOthers" class="badge others">自分以外</span>
              <span class="amount" :class="amountToneOf(sum)">
                ¥{{ sum.amount.toLocaleString() }} <span class="arrow-icon">›</span>
              </span>
            </span>
          </button>
        </div>
      </section>

      <div class="history-section" ref="timelineSection">
        <div class="section-header">
          <h3 class="section-title">立て替え履歴</h3>
          <button class="add-payment-btn" data-tour="ev-addpay" :disabled="eventData.ended !== false" @click="openNewPayment">
            {{ eventData.ended === true ? '終了済み（追加不可）' : '＋ 支払いを追加' }}
          </button>
        </div>

        <div class="filter-wrapper">
          <div class="ios-segmented-control">
            <button :class="{ active: histFilterScope === 'all' }" @click="histFilterScope = 'all'">全体</button>
            <button :class="{ active: histFilterScope === 'me' }" @click="histFilterScope = 'me'">自分のみ</button>
          </div>
          <div class="custom-select-wrapper auto-width">
            <select v-model="histFilterStatus" class="ios-select" aria-label="立て替え履歴の表示状態">
              <option value="unpaid">未払いのみ</option>
              <option value="all">すべて</option>
              <option value="completed">精算済み</option>
            </select>
          </div>
          <div class="custom-select-wrapper auto-width">
            <select v-model="histSort" class="ios-select" aria-label="立て替え履歴の並び順">
              <option value="new">新しい順</option>
              <option value="old">古い順</option>
            </select>
          </div>
        </div>

        <div class="timeline">
          <div v-if="filteredHistory.length === 0" class="empty-state">該当する履歴はありません</div>
          
          <div class="timeline-item" v-for="history in filteredHistory" :key="history.id" @click="openHistoryDetail(history)">
            <div class="timeline-line"></div>
            <div class="timeline-dot"></div>
            
            <div class="timeline-content">
              <div class="history-card" :class="{ 'unpaid-card': history.status === 'unpaid' }">
                <div class="history-main">
                  <div class="history-avatar history-avatar--cat">
                    <GenreIcon :type="history.category" />
                  </div>

                  <div class="history-text">
                    <span class="history-item-name">
                      <span class="history-item-title">{{ history.itemName }}</span>
                      <span class="split-type">{{ splitLabel(history.splitType) }}</span>
                    </span>
                    <span class="history-payer">{{ formatDate(history.date) }} {{ history.time }} • {{ payerNameOf(history) }} が立替</span>
                  </div>
                </div>
                <div class="history-right">
                  <span class="history-price">¥{{ history.amount.toLocaleString() }}</span>
                  <span v-if="history.status !== 'unpaid'" class="badge paid">精算済み</span>
                  <span v-else-if="isMyPayment(history)" class="badge receive">お支払い待ち ¥{{ myReceivableOf(history).toLocaleString() }}</span>
                  <span v-else-if="myShareSettled(history)" class="badge paid">あなたは精算済み</span>
                  <span v-else-if="mySharePending(history)" class="badge waiting">あなた ¥{{ myShareOf(history).toLocaleString() }}（申請中）</span>
                  <span v-else-if="myShareOf(history) > 0" class="badge owe">あなた ¥{{ myShareOf(history).toLocaleString() }}</span>
                  <span v-else class="badge pending">未払い</span>
                  <span v-if="history.status === 'unpaid' && history.shareCount > 1" class="badge progress">{{ history.settledCount }}/{{ history.shareCount }}人 精算済み</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="participants-card">
        <div class="participants-section" @click="openParticipants">
          <div class="participants-header">
            <span class="label">参加者 ({{ eventData.participants.length }}名)</span>
            <span class="arrow">›</span>
          </div>
          <div class="participants-row">
            <div class="avatar-stack">
              <UserAvatar
                v-for="(p, i) in eventData.participants.slice(0, 5)"
                :key="i"
                class="avatar"
                :style="{ zIndex: 10 - i }"
                :name="p.name"
                :photo="p.photo"
                :size="48"
              />
              <div v-if="eventData.participants.length > 5" class="avatar-more">
                +{{ eventData.participants.length - 5 }}
              </div>
            </div>
            <button class="invite-pill-btn" data-tour="ev-invite" @click.stop="inviteUser">
              <span class="icon">＋</span> 招待
            </button>
          </div>
        </div>

        <div class="invite-code-bar">
          <span class="icb-label">招待コード</span>
          <span class="icb-code">{{ eventData.invitationCode }}</span>
          <button class="icb-copy" @click="copyInviteCode">コピー</button>
        </div>

        <div v-if="eventData.locked || isLeader" class="lock-bar">
          <span v-if="eventData.locked" class="lock-chip">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="10" width="16" height="10" rx="2"></rect>
              <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
            </svg>
            承認制
          </span>
          <span v-else class="lock-note">コードを知っていれば誰でも参加できます</span>
          <button v-if="isLeader" class="lock-toggle" @click="toggleLock">
            {{ eventData.locked ? '承認制をやめる' : '承認制にする' }}
          </button>
        </div>
      </div>

      <div class="event-actions">
        <template v-if="eventData.ended">
          <p class="ended-chip">終了済み・記録は保存されています</p>
          <button class="end-event-btn" :disabled="reopening" @click="handleReopenEvent">{{ reopening ? '再開しています…' : 'イベントを再開する' }}</button>
          <p class="end-hint">支払いの追加を再開します。精算済みの記録は変わりません。</p>
        </template>
        <template v-else>
          <button class="end-event-btn" @click="handleEndEvent">イベントを終了する</button>
          <p class="end-hint">全員の精算が済んだら終了します。記録は残ります。</p>
        </template>
        <button class="delete-event-btn" @click="handleDeleteEvent">イベントを削除する</button>
        <p class="end-hint">自分の画面から非表示にします。7日以内ならゴミ箱から復元できます。</p>
      </div>
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
        :withReason="alertState.withReason"
        :reasonPlaceholder="alertState.reasonPlaceholder"
        @confirm="handleAlertConfirm"
        @cancel="alertState.show = false"
        @close="alertState.show = false"
      />
      <BaseModal
        :show="modals.unpaidWarning"
        type="warning"
        title="未精算の支払いが残っています"
        message="イベントを終了するには、全員の精算を済ませる必要があります。まとめて精算で、支払い回数を減らした結果を確認できます。"
        confirmText="まとめて精算へ"
        cancelText="閉じる"
        :showCancel="true"
        @confirm="showUnpaidSummary"
        @cancel="modals.unpaidWarning = false"
        @close="modals.unpaidWarning = false"
      />
      <div v-if="modals.participants" class="modal-overlay" @click.self="modals.participants = false">
        <div class="modal-content slide-up">
          <div class="modal-header"><h3>参加者一覧</h3><button class="close-btn" @click="modals.participants = false" aria-label="閉じる">×</button></div>
          <div class="modal-list">
            <div class="list-item" v-for="p in eventData.participants" :key="p.id">
              <UserAvatar class="avatar-medium" :name="p.name" :photo="p.photo" :size="44" />
              <span class="item-name">{{ p.name }} <span v-if="p.isMe" class="me-badge">自分</span> <span v-if="eventData.leaderUid && p.id === eventData.leaderUid" class="leader-badge">リーダー</span></span>
              <button v-if="!p.isMe && friendStatus[p.id] === 'none'" class="p-friend-btn" @click="sendFriendRequestTo(p)">フレンド申請</button>
              <span v-else-if="!p.isMe && friendStatus[p.id] === 'friend'" class="p-friend-tag">フレンド</span>
              <span v-else-if="!p.isMe && friendStatus[p.id] === 'requested'" class="p-friend-tag is-wait">申請済み</span>
              <button v-if="!p.isMe" class="p-remove-btn" :disabled="!!eventData.activeEventSettlementPlanId" @click="removeParticipant(p)" aria-label="外す">
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

      <ReceiptPaymentModal :isOpen="modals.historyDetail" :history="selectedHistory" :myAmount="selectedMyAmount" :myRole="selectedMyRole" @close="modals.historyDetail = false" @complete="markAsCompleted" @edit="openEditPayment" @delete="deletePayment" @revert="revertSettlement" />

      <div v-if="modals.summaryDetail && selectedSummary" class="modal-overlay" @click.self="modals.summaryDetail = false">
        <div class="modal-content settlement-detail-modal slide-up">
          <div class="modal-header"><h3>精算内容</h3><button class="close-btn" @click="modals.summaryDetail = false" aria-label="閉じる">×</button></div>
          <div class="summary-detail-body">
            <div class="summary-route">
              <div class="summary-person">
                <UserAvatar :name="selectedSummary.from" :photo="selectedSummary.fromPhoto" :size="40" />
                <span class="summary-person-name">{{ selectedSummary.from }}</span>
              </div>
              <span class="summary-arrow" aria-hidden="true">→</span>
              <div class="summary-person">
                <UserAvatar :name="selectedSummary.to" :photo="selectedSummary.toPhoto" :size="40" />
                <span class="summary-person-name">{{ selectedSummary.to }}</span>
              </div>
            </div>
            <h1 class="s-amount" :class="amountToneOf(selectedSummary)">¥{{ selectedSummary.amount.toLocaleString() }}</h1>
            <p class="s-role">{{ roleLabelOf(selectedSummary) }}</p>

            <div v-if="selectedSummary.details && selectedSummary.details.length > 0" class="breakdown-wrap">
              <button class="breakdown-toggle" type="button" :aria-expanded="showSummarySources" @click="showSummarySources = !showSummarySources">
                <span>計算の元：{{ selectedSummary.details.length }}件</span>
                <span class="breakdown-chevron" :class="{ open: showSummarySources }" aria-hidden="true">⌄</span>
              </button>
              <div v-if="showSummarySources" class="breakdown-list">
                <div class="breakdown-item" v-for="(detail, i) in selectedSummary.details" :key="i">
                  <span class="bd-name">{{ detail.itemName }}</span>
                  <div class="bd-right">
                    <span class="bd-who">{{ detail.from }} → {{ detail.to }}</span>
                    <span class="bd-amount">¥{{ detail.amount.toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="selectedSummary.isPreview && canStartNetSettlement"
              class="action-btn main summary-start-btn"
              :disabled="settlementBusy"
              @click="startNetSettlementFromDetail"
            >{{ settlementBusy ? '作成中…' : 'この内容でまとめて精算を始める' }}</button>

            <section v-if="selectedSummary.status === 'completed'" class="completed-section">
              <div class="completed-card">
                <span class="completed-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg></span>
                <h3 class="completed-title">精算済み</h3>
              </div>
            </section>
            <template v-if="!selectedSummary.isPreview && !selectedSummary.isOthers && selectedSummary.status === 'unpaid'">
              <p v-if="selectedSummary.isMePayer" class="s-hint">支払い後に報告してください</p>
              <p v-else class="s-hint">支払い報告を待っています</p>
              <button v-if="selectedSummary.isMePayer" class="action-btn main" :disabled="settlementBusy" @click="reportNetSettlementPayment(selectedSummary)">支払いを報告する</button>
            </template>
            <template v-else-if="!selectedSummary.isPreview && !selectedSummary.isOthers && selectedSummary.status === 'awaiting_approval'">
              <p v-if="selectedSummary.isMeReceiver" class="s-hint">入金を確認してください</p>
              <p v-else class="s-hint">受取確認を待っています</p>
              <div v-if="selectedSummary.isMeReceiver" class="receipt-actions">
                <button class="action-btn main" :disabled="settlementBusy" @click="decideNetSettlement(selectedSummary, 'approved')">受け取りました</button>
                <button class="action-btn reject" :disabled="settlementBusy" @click="decideNetSettlement(selectedSummary, 'rejected')">まだ受け取っていません</button>
              </div>
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
        :eventId="route.params.id || ''"
        :eventName="eventData.name || ''"
        :eventEnded="!!eventData.ended"
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

// 🌟 参加者の「名前＋アイコン」を実データから取得（"メンバー" 固定表示を解消）
const userInfoCache = {};
const getUserInfo = async (uid) => {
  if (!uid) return { name: "メンバー", photo: "" };
  if (userInfoCache[uid]) return userInfoCache[uid];
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const info = {
        name: data.name || "メンバー",
        photo: data.photoURL || data.photo || "",
      };
      userInfoCache[uid] = info;
      return info;
    }
  } catch (e) { console.error(e); }
  return { name: "メンバー", photo: "" };
};

// ==========================================
// 🌟 1. 2人の import を綺麗に合体！
// ==========================================
import { ref, computed, watch, onMounted, onUnmounted, reactive, nextTick } from 'vue'; // 🌟 reactiveを追加
import { useRoute, useRouter } from 'vue-router';
import { formatDate } from '@/lib/format';
import { ensurePaymentThread, postPaymentEvent, postPaymentEventByTx, resolvePaymentThreadByTx, retirePaymentThread } from '@/lib/thread';
import { getMyName } from '@/lib/userName';
import { UNPAID_PATCH } from '@/lib/settlement';
import { useEventActionContext } from '@/composables/useEventActionContext';
import { buildEventNetSettlement } from '@/lib/eventNetSettlement';

import AddPaymentModal from '@/components/AddPaymentModal.vue';
import ReceiptPaymentModal from '@/components/ReceiptPaymentModal.vue';
import InviteModal from '@/components/InviteModal.vue';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 統一モーダルを追加！
import PageHeader from '@/components/PageHeader.vue';
import GenreIcon from '@/components/GenreIcon.vue'; // 🌟 イベントのジャンルアイコン
import UserAvatar from '@/components/UserAvatar.vue';

// 🌟 どこからでも呼べる美しいアラートの準備
const alertState = reactive({ show: false, type: 'info', title: '', message: '', showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, withReason: false, reasonPlaceholder: '' });
const showAlert = (type, title, message) => {
  Object.assign(alertState, { type, title, message, showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, withReason: false, show: true });
};
// 🌟 はい／いいえ の確認ダイアログ（誤操作防止）
const showConfirm = (title, message, onConfirm, opts = {}) => {
  Object.assign(alertState, {
    type: opts.type || 'warning', title, message,
    showCancel: true, confirmText: opts.confirmText || 'はい', cancelText: opts.cancelText || 'いいえ',
    withReason: !!opts.withReason, reasonPlaceholder: opts.reasonPlaceholder || '理由を書けます（任意・相手に届きます）',
    onConfirm, show: true,
  });
};
const handleAlertConfirm = (reason) => {
  const cb = alertState.onConfirm;
  alertState.show = false;
  if (cb) cb(reason);
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
import { collection, addDoc, setDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, increment, deleteDoc, getDocs, where, arrayRemove, arrayUnion } from 'firebase/firestore';

// 🌟 人ごとの精算状況（誰の分が済んでいるか）を出す共通計算
import { decorateHistory, settlementProgressOf, outstandingTotalOf, plainShares, PENDING } from '@/lib/eventStatus';

// ==========================================
// 🌟 2. 初期設定・データ定義
// ==========================================
const route = useRoute();
const router = useRouter();
const timelineSection = ref(null);
// 🌟 自分の表示名は実データ（users/{uid}.name）から取得する
const myName = ref('');
const moneyBusy = ref(false); // 🌟 支払い保存・決済完了の二重送信ガード（取引の二重計上・重複記録を防ぐ）

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
  if (eventData.value.activeEventSettlementPlanId) {
    showAlert('info', '精算中は外せません', 'まとめて精算が完了してから参加者を変更してください。');
    return;
  }
  showConfirm('参加者を外す', `${p.name} さんをこのイベントから外しますか？`, async () => {
    try {
      await updateDoc(doc(db, 'events', route.params.id), { participants: arrayRemove(p.id) });
      // 外された本人にお知らせを届ける（自分の画面からイベントが消えるため）
      await notifyParticipants([p.id], {
        type: 'event_member_removed',
        eventName: eventData.value.name || '',
        message: 'このイベントは一覧から消えます。心当たりがなければ、相手に確認してください。',
      });
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
  ended: null, // 読み込み完了後に true / false を設定
  activeEventSettlementPlanId: null,
  lastEventSettlementPlanId: null,
  leaderUid: null, // 🌟 リーダー（作った人）。古いイベントには無いので null
  locked: false,   // 🌟 鍵付き＝参加にリーダーの承認が必要
  participants: [],
  history: []
});
const { setPaymentAvailability } = useEventActionContext();
watch(() => eventData.value.ended, (ended) => {
  setPaymentAvailability(ended == null ? null : !ended);
}, { immediate: true });

// 🌟 自分がリーダーか（リーダーの情報が無い古いイベントでは常に false）
const isLeader = computed(() => !!eventData.value.leaderUid && eventData.value.leaderUid === auth.currentUser?.uid);

// 🌟 鍵付きの切り替え（リーダーだけ）
const toggleLock = async () => {
  if (!isLeader.value) return;
  const next = !eventData.value.locked;
  try {
    await updateDoc(doc(db, 'events', route.params.id), { locked: next });
    showToast(next ? '承認制にしました' : '承認制をやめました');
  } catch (e) {
    console.error('承認制の切り替えエラー:', e);
    showAlert('error', 'エラー', '設定を変更できませんでした。');
  }
};

const histFilterScope = ref('all'); 
const histSort = ref('new'); 
const histFilterStatus = ref('unpaid');

const filteredHistory = computed(() => {
  let result = eventData.value.history.filter(h => {
    const scopeMatch = histFilterScope.value === 'all' || isMyPayment(h) || myShareOf(h) > 0;
    // 「自分のみ」では自分の負担分を見る。全体では立て替え全体の完了状態を使う。
    const status = histFilterScope.value === 'me' && !isMyPayment(h)
      ? (myShareSettled(h) ? 'completed' : 'unpaid')
      : h.status;
    const statusMatch = histFilterStatus.value === 'all' || status === histFilterStatus.value;
    return scopeMatch && statusMatch;
  });
  return result.sort((a, b) => histSort.value === 'new' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
});

const unpaidItems = computed(() => eventData.value.history.filter(h => h.status === 'unpaid'));
const hasUnpaidTransactions = computed(() => Object.values(txById.value || {})
  .some((transaction) => (transaction.status || 'unpaid') !== 'completed'));

// まとめて精算の進行中は、その支払い行を正として残額と進捗を表示する。
// 元の取引は全行が終わるまで未払いのまま固定するため、履歴だけで数えると
// 確定済みの行が上部へ反映されない。通常時は従来どおり履歴から算出する。
const outstandingTotal = computed(() => {
  if (eventData.value.activeEventSettlementPlanId && settlementLegs.value.length) {
    return settlementLegs.value
      .filter((row) => row.status !== 'completed')
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }
  return outstandingTotalOf(eventData.value.history);
});

const settlementProgress = computed(() => {
  if (eventData.value.activeEventSettlementPlanId && settlementLegs.value.length) {
    const total = settlementLegs.value.length;
    const done = settlementLegs.value.filter((row) => row.status === 'completed').length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }
  return settlementProgressOf(eventData.value.history);
});

const scrollToTimeline = () => timelineSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const summaryHeading = ref(null);
const showUnpaidSummary = async () => {
  modals.value.unpaidWarning = false;
  modals.value.summaryDetail = false;
  await nextTick();
  const heading = summaryHeading.value;
  if (!heading) return;
  heading.focus({ preventScroll: true });
  const scroller = heading.closest('.app-main');
  if (scroller) {
    const headerHeight = scroller.querySelector('.event-page-header')?.getBoundingClientRect().height || 0;
    scroller.scrollTo({
      top: scroller.scrollTop + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - headerHeight - 12,
      behavior: 'smooth',
    });
  } else {
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};
// 🌟 立替履歴の役割判定は「UID」で行う（名前一致のブレを避ける）
const isMyPayment = (h) => {
  const myUid = auth.currentUser?.uid;
  if (h.payerUid) return h.payerUid === myUid;
  return h.payer === myName.value; // 後方互換（payerUid 無しの古い履歴）
};
const myShareOfRecord = (h) => {
  const myUid = auth.currentUser?.uid;
  let s = myUid && (h.shares || []).find((x) => x && x.uid === myUid);
  if (!s) s = (h.shares || []).find((x) => x && !x.uid && x.name === myName.value); // UIDのない古い負担分だけ名前で照合
  return s || null;
};
const myShareOf = (h) => {
  const s = myShareOfRecord(h);
  return s ? (Number(s.amount) || 0) : 0;
};
// 🌟 自分の負担分がもう精算済みか（他の人が残っていても、自分の分だけを見る）
const myShareSettled = (h) => {
  const s = myShareOfRecord(h);
  return !!(s && s.settled);
};
// 🌟 自分の負担分が申請中（相手の承認待ち）か
const mySharePending = (h) => {
  const s = myShareOfRecord(h);
  return !!(s && s.status === PENDING);
};
// 🌟 立替者がまだ受け取れていない額（済んだ人の分は差し引く）
const myReceivableOf = (h) => Number(h.outstanding) || 0;

// 🌟 取引詳細を開くとき、閲覧者にとっての「金額・立場」を計算して渡す
const selectedMyAmount = ref(0);
const selectedMyRole = ref('none'); // 'payer'（受け取る側）/ 'debtor'（払う側）/ 'none'
const showSummarySources = ref(false);
const openHistoryDetail = (h) => {
  selectedHistory.value = h;
  const total = Number(h.amount) || 0;
  const myShare = myShareOf(h);
  if (isMyPayment(h)) {
    selectedMyRole.value = 'payer';
    selectedMyAmount.value = myReceivableOf(h); // まだ受け取れていない額（済んだ人の分は除く）
  } else if (myShare > 0) {
    selectedMyRole.value = 'debtor';
    selectedMyAmount.value = myShare;          // 自分が払う額
  } else {
    selectedMyRole.value = 'none';
    selectedMyAmount.value = total;
  }
  modals.value.historyDetail = true;
};
const openSummaryDetail = (s) => {
  selectedSummary.value = s;
  showSummarySources.value = false;
  modals.value.summaryDetail = true;
};

// 🌟 金額の色は「自分にとってどちら向きか」で決める。
//    自分が受け取る＝ブルー / 自分が支払う＝アンバー / 他人同士＝グレー。
//    以前は自分が関係しない行もブルーで出ていて、自分がプラスになると読めてしまった。
const amountToneOf = (s) => {
  if (!s) return 'muted-text';
  if (!s.involvesMe) return 'muted-text';
  return s.isMePayer ? 'orange-text' : 'blue-text';
};
const roleLabelOf = (s) => {
  if (!s) return '';
  if (s.isPreview) return '精算前';
  if (!s.involvesMe) return '自分以外の精算';
  return s.isMePayer ? '支払う' : '受け取る';
};

// 🌟 支払いの編集：詳細を閉じて、編集モードで支払いモーダルを開く
const editingHistory = ref(null);
const openNewPayment = () => {
  if (eventData.value.ended !== false) {
    if (eventData.value.ended == null) {
      showToast('イベントを読み込んでいます');
      return;
    }
    showAlert('info', '終了済みのイベントです', 'このイベントは終了しています。支払いを追加する場合は、イベントを再開してください。');
    return;
  }
  editingHistory.value = null;
  modals.value.addPayment = true;
};

// 同じ詳細画面で「＋」を押した場合も、追加要求を1回ずつ受け取る。
let autoAddOpened = false;
watch([
  () => route.query.addPayment,
  () => (eventData.value.participants || []).length,
  () => eventData.value.ended,
], async ([request, count, ended]) => {
  if (request !== '1') { autoAddOpened = false; return; }
  if (count === 0 || autoAddOpened) return;
  autoAddOpened = true;
  openNewPayment();
  // 終了済みでも要求は消費し、後から再開しても勝手に開かないようにする。
  const { addPayment, ...query } = route.query;
  try {
    await router.replace({ query });
  } catch (error) {
    console.error('追加画面のURL更新に失敗:', error);
  }
}, { immediate: true });
const historyUsesNetSettlement = (history) => (history?.transactionIds || [])
  .some((transactionId) => !!txById.value[transactionId]?.eventSettlementPlanId);
const explainLockedHistory = () => showAlert(
  'info',
  'まとめて精算に含まれています',
  'この立て替えはまとめて精算に含まれているため、個別には変更できません。「まとめて精算」の行から状況を確認してください。',
);
const openEditPayment = (h) => {
  if (historyUsesNetSettlement(h)) { explainLockedHistory(); return; }
  editingHistory.value = h;
  modals.value.historyDetail = false;
  modals.value.addPayment = true;
};

// 🌟 支払いの変更を関係者（立替者＋負担者）へ通知（自分以外）
// 割り勘方法の表示ラベル（差分表示用）
const splitLabel = (t) => ({ all: '全員で均等', custom: '金額指定', item: '商品ごと' }[t] || t || 'なし');
// 🌟 立替者名は payerUid から現在の参加者名で表示（改名に追従）
const payerNameOf = (h) => {
  if (h && h.payerUid) {
    const p = eventData.value.participants.find(x => x.id === h.payerUid);
    if (p && p.name) return p.name;
  }
  return (h && h.payer) || 'メンバー';
};

// 🌟 変更を参加者（自分以外）へ通知する汎用ヘルパー
const notifyParticipants = async (uids, notifData) => {
  const myUid = auth.currentUser?.uid;
  const fromName = myName.value || await getMyName();
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
  if (historyUsesNetSettlement(h)) { explainLockedHistory(); return; }
  modals.value.historyDetail = false; // 詳細シートを先に閉じて、確認を1つだけにする
  showConfirm('支払いを削除', `「${h.itemName}」（¥${(Number(h.amount) || 0).toLocaleString()}）を削除しますか？\nゴミ箱に入り、7日以内なら元に戻せます。`, async (reason) => {
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
              // 画面で足した計算結果（人ごとの状態）は保存しない＝控えは元の形のまま
              shares: plainShares(h.shares), category: h.category || 'その他',
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
      await notifyParticipants(involved, { type: 'payment_deleted', itemName: h.itemName, amount: Number(h.amount) || 0, eventName: eventData.value.name || '', trashId: trashDocId, userMessage: reason || null });
      modals.value.historyDetail = false;
      showToast('支払いをゴミ箱に移動しました');
    } catch (e) {
      console.error('支払い削除エラー:', e);
      showAlert('error', 'エラー', '支払いの削除に失敗しました。');
    }
  }, { confirmText: '削除', cancelText: 'やめる', withReason: true, reasonPlaceholder: '削除の理由を書けます（任意・相手に届きます）' });
};

// ==========================================
// 🌟 4. Firestore データベース操作
// ==========================================
// 決済完了の入口（詳細シートを閉じて、綺麗な確認を1つだけ出す）
const markAsCompleted = (id) => {
  const hist = eventData.value.history.find(h => h.id === id);
  if (historyUsesNetSettlement(hist)) { explainLockedHistory(); return; }
  modals.value.historyDetail = false;
  showConfirm(
    '決済を完了しますか？',
    `「${hist?.itemName || '決済'}」を完了として記録します。\n間違えたときは、この決済の詳細から「未精算に戻す」で戻せます。`,
    () => doMarkAsCompleted(id),
    { confirmText: '完了する', cancelText: 'やめる' }
  );
};

const doMarkAsCompleted = async (id) => {
  if (moneyBusy.value) return; // 🌟 連打で完了処理・ゴミ箱記録が重複するのを防ぐ
  moneyBusy.value = true;
  try {
    const eventId = route.params.id || "test-event-1";
    const myUid = auth.currentUser?.uid;
    const hist = eventData.value.history.find(h => h.id === id);
    const txIds = hist?.transactionIds || [];
    const myNm = myName.value || '立替者';
    // 🌟 紐づく取引(transactions)を完了にする（履歴/サマリーのstatusはここから導出される）
    for (const tid of txIds) {
      await updateDoc(doc(db, "transactions", tid), { status: 'completed' });
      await postPaymentEventByTx(tid, { text: `${myNm}さんが精算済みにしました`, kind: 'completed', actorUid: myUid });
    }
    // 全員完了ならグループチャットを片付ける
    if (txIds[0]) await resolvePaymentThreadByTx(txIds[0]);
    // 履歴ドキュメントのstatusもキャッシュとして更新
    await updateDoc(doc(db, "events", eventId, "history", id), { status: 'completed' });
    if (hist) hist.status = 'completed'; // ローカルにも即反映

    // 完了した決済は「精算済み」として履歴に残る。間違えたときは決済の詳細から
    // 「未精算に戻す」で戻せる（ゴミ箱には入れない）。
    modals.value.historyDetail = false;
    showToast('決済を完了しました（決済の詳細から未精算に戻せます）');
  } catch (error) {
    console.error("更新エラー:", error);
    showAlert('error', '更新エラー', '決済の更新に失敗しました。電波状況を確認してください。');
  } finally {
    moneyBusy.value = false;
  }
};

// 🌟 精算済みを「未精算に戻す」（間違えて完了にしたとき用・決済の詳細から）
const revertSettlement = (hist) => {
  if (historyUsesNetSettlement(hist)) { explainLockedHistory(); return; }
  modals.value.historyDetail = false;
  showConfirm(
    '未精算に戻しますか？',
    `「${hist?.itemName || '決済'}」を未払いに戻します。関係する人に通知が届きます。`,
    () => doRevertSettlement(hist),
    { confirmText: '未精算に戻す', cancelText: 'やめる' }
  );
};
const doRevertSettlement = async (hist) => {
  if (moneyBusy.value || !hist) return;
  moneyBusy.value = true;
  try {
    const eventId = route.params.id || "test-event-1";
    const myUid = auth.currentUser?.uid;
    const myNm = myName.value || '立替者';
    const txIds = hist.transactionIds || [];
    for (const tid of txIds) {
      // 未精算に戻すので、通常精算の差し引き記録も消す
      await updateDoc(doc(db, "transactions", tid), { ...UNPAID_PATCH });
      await postPaymentEventByTx(tid, { text: `${myNm}さんが精算を取り消しました（未払いに戻りました）`, kind: 'reverted', actorUid: myUid });
    }
    await updateDoc(doc(db, "events", eventId, "history", hist.id), { status: 'unpaid' });
    if (hist) hist.status = 'unpaid';
    // 関係者（自分以外）に通知
    const others = [];
    const seen = new Set();
    const addOther = (uid) => { if (uid && uid !== myUid && !seen.has(uid)) { seen.add(uid); others.push(uid); } };
    if (hist.payerUid) addOther(hist.payerUid);
    (hist.shares || []).forEach(s => addOther(s.uid));
    if (others.length) {
      await notifyParticipants(others, { type: 'payment_reverted', itemName: hist.itemName || '', amount: Number(hist.amount) || 0, eventName: eventData.value.name || '' });
    }
    showToast('未精算に戻しました');
  } catch (error) {
    console.error('未精算戻しエラー:', error);
    showAlert('error', 'エラー', '未精算に戻せませんでした。電波状況を確認してください。');
  } finally {
    moneyBusy.value = false;
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
  if (moneyBusy.value) return; // 🌟 連打で取引が二重作成されるのを防ぐ
  moneyBusy.value = true;
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

    // 🌟 編集モード：古い取引と合計を先に取り消す。
    //    履歴ドキュメントは削除せず同じIDに書き直す（IDが変わるとグループチャットが
    //    pay-古いID のまま取り残され、中身の無い会話が一覧に残ってしまうため）。
    let oldPay = null;
    let reuseHistoryId = null;
    if (newPayment.editId) {
      const old = eventData.value.history.find(h => h.id === newPayment.editId);
      if (old) {
        // 差分表示のために編集前の値を控えておく
        oldPay = { amount: old.amount, itemName: old.itemName, category: old.category, payer: old.payer, splitType: old.splitType };
        reuseHistoryId = old.id;
        for (const tid of (old.transactionIds || [])) {
          try { await deleteDoc(doc(db, "transactions", tid)); } catch (e) { console.error(e); }
        }
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
    const debtorUids = []; // この立て替えで支払う人（グループチャットの参加者に使う）
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
        eventName: eventData.value.name || '',  // 件名表示用にイベント名も保存
        itemName: newPayment.itemName,
        createdAt: serverTimestamp(),
      });
      transactionIds.push(txRef.id);
      debtorUids.push(s.uid);
    }

    // 🌟 2. このイベント内の「立て替え履歴」サブコレクションへ保存
    //    編集のときは同じIDに丸ごと書き直す（＝チャットの件も引き継がれる）
    const historyPayload = {
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
      shares: newPayment.shares || [], // 🌟 各メンバーの負担額
      items: newPayment.items || [],
      transactionIds: transactionIds // 🌟 決済完了時に transactions 側も更新するための紐付け（A-7で使用）
    };
    let historyId;
    if (reuseHistoryId) {
      historyId = reuseHistoryId;
      await setDoc(doc(db, "events", eventId, "history", historyId), historyPayload); // 同じIDに丸ごと上書き
    } else {
      const historyDoc = await addDoc(collection(db, "events", eventId, "history"), historyPayload);
      historyId = historyDoc.id;
    }

    // 🌟 ここまでが「支払いそのものの保存」（取引 + 立て替え履歴）。
    //    以下のチャット・合計金額・通知は、保存が済んだあとの付随処理。
    //    ここで転んでも支払いは記録できているので、「保存エラー」とは知らせない
    //    （履歴には出ているのにエラーが出る、という食い違いを防ぐ）。
    //    付随処理は1つ転んでも途中で止めず、最後まで走らせる。失敗したものだけを
    //    種別（チャット / 合計金額 / 通知）で控えておき、最後のお知らせで実際に
    //    失敗した範囲だけを並べる（文言と中身の食い違いを防ぐ）。
    const sideEffectFails = [];
    const markFailed = (kind, e) => {
      if (!sideEffectFails.includes(kind)) sideEffectFails.push(kind); // 同じ種別は1回だけ
      console.error(`⚠️ 支払いは保存できたが「${kind}」の反映に失敗:`, e);
    };

    // 🌟 各取引に historyId を紐づける（経緯をグループチャットに流すとき特定に使う）
    //    ここが欠けるとチャットに経緯が出なくなるので、種別は「チャット」で扱う
    for (const tid of transactionIds) {
      try { await updateDoc(doc(db, "transactions", tid), { historyId }); } catch (e) { markFailed('チャット', e); }
    }

    // 🌟 支払いグループチャットを作成（立て替えを追加した瞬間に「件」ができる）
    if (debtorUids.length > 0) {
      try {
        const parts = [creditorUid, ...debtorUids];
        const nameOfP = (uid) => (eventData.value.participants.find(p => p.id === uid)?.name) || 'メンバー';
        const pNames = {}; parts.forEach(u => { pNames[u] = nameOfP(u); });
        await ensurePaymentThread(historyId, {
          participants: parts, participantNames: pNames, creditorUid,
          eventId, eventName: eventData.value.name || '', itemName: newPayment.itemName,
          amount: Number(newPayment.amount), transactionIds,
        });
        // 編集のときは同じチャットが続くので、経緯を1行残す（相手の未読も点く）
        if (reuseHistoryId) {
          await postPaymentEvent(historyId, {
            text: `${myName.value || '立替者'}さんが支払いの内容を編集しました（¥${Number(newPayment.amount).toLocaleString()}）`,
            kind: 'edited', actorUid: myUid,
          });
        }
      } catch (e) { markFailed('チャット', e); }
    } else if (reuseHistoryId) {
      // 編集で割り勘の相手がいなくなった＝この件のチャットはもう用が無いので片付ける
      try { await retirePaymentThread(reuseHistoryId); } catch (e) { markFailed('チャット', e); }
    }

    // 🌟 3. イベント本体の合計金額(totalAmount)を更新
    try {
      await updateDoc(doc(db, "events", eventId), {
        totalAmount: increment(Number(newPayment.amount))
      });
    } catch (e) { markFailed('合計金額', e); }

    // 🌟 編集なら参加者全員（自分以外）に「編集された」通知を送る（変更内容の差分つき）
    if (newPayment.editId) {
      try {
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
          userMessage: newPayment.editNote || null,
        });
      } catch (e) { markFailed('通知', e); }
    }

    console.log("✅ 支払いを保存しました 履歴ID:", historyId);
    modals.value.addPayment = false;
    if (sideEffectFails.length > 0) {
      // 支払い自体は残っているので、失敗した範囲だけを正しく伝える
      showToast(`支払いは保存しました（${sideEffectFails.join('・')}の反映ができませんでした）`);
    }

    // 保存後にタイムラインへスクロール
    setTimeout(scrollToTimeline, 300);
  } catch (error) {
    console.error("❌ 保存失敗:", error);
    showAlert('error', '保存エラー', 'データの保存に失敗しました。');
  } finally {
    moneyBusy.value = false;
  }
};

// リアルタイム監視
// Firestore リスナーの購読解除用（onUnmounted / 削除時に解除）
let unsubEvent = null;
let unsubHistory = null;
let unsubTx = null;

// 🌟 履歴（Firestoreの生データ）と、このイベントの取引の状態を別々に持つ。
//    どちらが更新されても人ごとの精算状況を作り直す（下の watch）。
const rawHistory = ref([]);
const historyLoaded = ref(false);
const txById = ref({});
const txLoaded = ref(false);
const settlementPlan = ref(null);
const settlementLegs = ref([]);
const settlementPlanLoaded = ref(false);
const settlementBusy = ref(false);
const settlementFilter = ref('unpaid');
let unsubSettlementPlan = null;
let unsubSettlementLegs = null;
let subscribedSettlementPlanId = null;

const participantFor = (uid) => eventData.value.participants.find((person) => person.id === uid) || {};
const requestId = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const localNetSettlement = computed(() => {
  if (!txLoaded.value || eventData.value.participants.length === 0) {
    return { result: null, error: '' };
  }
  try {
    return {
      result: buildEventNetSettlement({
        transactions: Object.values(txById.value),
        participants: eventData.value.participants,
      }),
      error: '',
    };
  } catch (error) {
    return { result: null, error: error?.message || '精算額を計算できませんでした。' };
  }
});

const rowForDisplay = (row, { preview = false, details = [] } = {}) => {
  const from = participantFor(row.fromId);
  const to = participantFor(row.toId);
  const myUid = auth.currentUser?.uid || '';
  const detailIds = Array.isArray(row.sourceTransactionIds) ? new Set(row.sourceTransactionIds) : null;
  return {
    ...row,
    from: from.name || 'メンバー',
    fromPhoto: from.photo || '',
    to: to.name || 'メンバー',
    toPhoto: to.photo || '',
    involvesMe: row.fromId === myUid || row.toId === myUid,
    isMePayer: row.fromId === myUid,
    isMeReceiver: row.toId === myUid,
    isOthers: row.fromId !== myUid && row.toId !== myUid,
    isPreview: preview,
    details: details.filter((detail) => !detailIds || detailIds.has(detail.id)).map((detail) => ({
      ...detail,
      from: participantFor(detail.paidById).name || 'メンバー',
      to: participantFor(detail.paidToId).name || 'メンバー',
    })),
  };
};

const netSettlementRows = computed(() => {
  const preview = localNetSettlement.value.result;
  const hasActivePlan = !!eventData.value.activeEventSettlementPlanId;
  const savedRows = settlementPlan.value && settlementLegs.value.length
    ? settlementLegs.value.map((row) => rowForDisplay(row, {
      details: settlementPlan.value.sourceTransactions || [],
    }))
    : [];
  if (hasActivePlan) return savedRows;
  const previewRows = preview?.transfers?.length
    ? preview.transfers.map((row) => rowForDisplay(row, {
      preview: true,
      details: preview.sourceTransactions,
    }))
    : [];
  return [...previewRows, ...savedRows.filter((row) => row.status === 'completed')];
});

const filteredNetSettlementRows = computed(() => netSettlementRows.value
  .filter((row) => settlementFilter.value === 'all'
    || (settlementFilter.value === 'completed' ? row.status === 'completed' : row.status !== 'completed'))
  .sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed')));

const settlementEmptyText = computed(() => {
  if (!txLoaded.value) return '精算額を読み込んでいます';
  if (settlementFilter.value === 'completed') return '確定した支払いはありません';
  if (settlementFilter.value === 'unpaid') return '現在、まとめて支払う金額はありません';
  return '表示する支払いはありません';
});

const netSettlementError = computed(() => {
  if (eventData.value.activeEventSettlementPlanId || settlementPlan.value?.status === 'completed') return '';
  return localNetSettlement.value.error;
});
const canStartNetSettlement = computed(() => eventData.value.ended === false
  && !eventData.value.activeEventSettlementPlanId
  && !!localNetSettlement.value.result?.transfers?.length);
const hasUnresolvedSettlementReview = computed(() => settlementLegs.value
  .some((row) => row.status === 'unpaid' && row.reviewRequired === true));
const canRefreshNetSettlement = computed(() => eventData.value.ended === false
  && !!eventData.value.activeEventSettlementPlanId
  && !hasUnresolvedSettlementReview.value
  && !!localNetSettlement.value.result?.sourceTransactions?.length);

const clearSettlementSubscriptions = () => {
  if (unsubSettlementPlan) { unsubSettlementPlan(); unsubSettlementPlan = null; }
  if (unsubSettlementLegs) { unsubSettlementLegs(); unsubSettlementLegs = null; }
  subscribedSettlementPlanId = null;
};

const subscribeSettlementPlan = (planId) => {
  if (planId === subscribedSettlementPlanId) return;
  clearSettlementSubscriptions();
  settlementPlan.value = null;
  settlementLegs.value = [];
  settlementPlanLoaded.value = false;
  if (!planId) {
    settlementPlanLoaded.value = true;
    return;
  }
  subscribedSettlementPlanId = planId;
  const planRef = doc(db, 'eventSettlementPlans', planId);
  unsubSettlementPlan = onSnapshot(planRef, (snap) => {
    settlementPlan.value = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    settlementPlanLoaded.value = true;
  }, (error) => {
    settlementPlanLoaded.value = true;
    if (error?.code !== 'permission-denied') console.error('まとめて精算の読込エラー:', error);
  });
  unsubSettlementLegs = onSnapshot(collection(planRef, 'legs'), (snap) => {
    settlementLegs.value = snap.docs
      .map((leg) => ({ id: leg.id, ...leg.data() }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, (error) => {
    if (error?.code !== 'permission-denied') console.error('まとめて精算の支払い読込エラー:', error);
  });
};

// まとめて精算のお知らせは、保存されたIDをそのまま実行せず、
// 現在読み込んだ計画と支払い行を照合してから最新状態の詳細を開く。
let openedSettlementQuery = '';
watch([
  () => route.query.settlement,
  () => route.query.leg,
  () => route.query.request,
  settlementPlan,
  settlementLegs,
  settlementPlanLoaded,
], async ([planParam, legParam, requestParam, plan, legs, planLoaded]) => {
  const planId = Array.isArray(planParam) ? planParam[0] : planParam;
  const legId = Array.isArray(legParam) ? legParam[0] : legParam;
  const paymentRequestId = Array.isArray(requestParam) ? requestParam[0] : requestParam;
  if (!planId || !legId || !planLoaded || eventData.value.ended == null) return;
  const key = `${planId}:${legId}:${paymentRequestId || ''}`;
  if (openedSettlementQuery === key) return;
  const expectedLegIds = Array.isArray(plan?.legIds) ? plan.legIds : [];
  if (plan?.id === planId && expectedLegIds.includes(legId) && !legs.some((row) => row.id === legId)) return;
  openedSettlementQuery = key;

  if (!plan || plan.id !== planId) {
    showAlert('info', '以前のまとめて精算です', 'このお知らせの精算は現在の計画ではありません。画面に表示されている最新のまとめて精算を確認してください。');
  } else {
    const current = legs.find((row) => row.id === legId);
    const currentRequestId = current?.status === 'awaiting_approval'
      ? current.paymentRequestId
      : current?.lastDecisionRequestId;
    if (!current || (paymentRequestId && currentRequestId !== paymentRequestId)) {
      showAlert('info', '支払いの状態が変わっています', 'このお知らせの支払いは更新されています。画面に表示されている最新のまとめて精算を確認してください。');
    } else {
      await nextTick();
      openSummaryDetail(rowForDisplay(current, { details: plan.sourceTransactions || [] }));
    }
  }

  const { settlement, leg, request, ...query } = route.query;
  try {
    await router.replace({ query });
  } catch (error) {
    console.error('まとめて精算のお知らせURL更新に失敗:', error);
  }
}, { immediate: true });

const callNetSettlement = async (data) => {
  const callable = httpsCallable(functions, 'eventNetSettlement');
  const response = await callable(data);
  return response.data;
};

const startNetSettlement = () => {
  if (!canStartNetSettlement.value || settlementBusy.value) return;
  showConfirm(
    'まとめて精算を始めますか？',
    '元の立て替え記録と各人の最終金額は変わりません。完了するまで、対象の立て替えは個別に精算・編集できません。',
    async () => {
      settlementBusy.value = true;
      try {
        const result = await callNetSettlement({ action: 'start', eventId: route.params.id, requestId: requestId() });
        subscribeSettlementPlan(result.planId);
        showToast(result.alreadyActive ? '進行中のまとめて精算を表示します' : 'まとめて精算を開始しました');
      } catch (error) {
        console.error('まとめて精算の作成エラー:', error);
        showAlert('error', '開始できませんでした', error?.message || '画面を開き直して、もう一度お試しください。');
      } finally {
        settlementBusy.value = false;
      }
    },
    { type: 'info', confirmText: '開始する', cancelText: 'やめる' },
  );
};

// 計算結果の詳細から開始するときも、同じ確認処理に通す。
// 詳細モーダルを先に閉じ、確認画面が背面に隠れないようにする。
const startNetSettlementFromDetail = () => {
  if (!canStartNetSettlement.value || settlementBusy.value) return;
  modals.value.summaryDetail = false;
  startNetSettlement();
};

const refreshNetSettlement = () => {
  if (hasUnresolvedSettlementReview.value) {
    showAlert(
      'info',
      '先に送金状況を確認してください',
      '受取を確認できなかった支払いは、自動で組み替えません。該当する行を開き、実際に支払い済みならもう一度報告してください。',
    );
    return;
  }
  if (!canRefreshNetSettlement.value || settlementBusy.value || !settlementPlan.value?.id) return;
  showConfirm(
    '追加分を反映しますか？',
    '確定済みと受取確認待ちの支払いは変えず、未精算分と追加された立て替えだけを計算し直します。',
    async () => {
      settlementBusy.value = true;
      try {
        const result = await callNetSettlement({
          action: 'refresh', planId: settlementPlan.value.id, requestId: requestId(),
        });
        showToast(result.changed ? '追加分を反映しました' : '追加分はありませんでした');
      } catch (error) {
        console.error('まとめて精算の更新エラー:', error);
        showAlert('error', '反映できませんでした', error?.message || '画面を開き直して、もう一度お試しください。');
      } finally {
        settlementBusy.value = false;
      }
    },
    { type: 'info', confirmText: '反映する', cancelText: 'やめる' },
  );
};

const reportNetSettlementPayment = (row) => {
  if (!row?.isMePayer || row.status !== 'unpaid' || settlementBusy.value) return;
  showConfirm(
    '支払いを報告しますか？',
    `${row.to} さんへ ¥${row.amount.toLocaleString()} を実際に支払った後で報告してください。`,
    async () => {
      settlementBusy.value = true;
      try {
        await callNetSettlement({
          action: 'report', planId: settlementPlan.value.id, legId: row.id, requestId: requestId(),
        });
        modals.value.summaryDetail = false;
        showToast('受取確認を依頼しました');
      } catch (error) {
        console.error('まとめて精算の支払報告エラー:', error);
        showAlert('error', '報告できませんでした', error?.message || '画面を開き直して、もう一度お試しください。');
      } finally {
        settlementBusy.value = false;
      }
    },
    { type: 'info', confirmText: '報告する', cancelText: 'やめる' },
  );
};

const decideNetSettlement = (row, decision) => {
  if (!row?.isMeReceiver || row.status !== 'awaiting_approval' || settlementBusy.value) return;
  const approved = decision === 'approved';
  showConfirm(
    approved ? '受け取りを確定しますか？' : 'まだ受け取りを確認できませんか？',
    approved
      ? `¥${row.amount.toLocaleString()} の入金を確認した場合だけ確定してください。`
      : 'この支払いを未払いへ戻し、支払う人へもう一度確認を依頼します。',
    async () => {
      settlementBusy.value = true;
      try {
        await callNetSettlement({
          action: 'decide', planId: settlementPlan.value.id, legId: row.id,
          requestId: row.paymentRequestId, decision,
        });
        modals.value.summaryDetail = false;
        showToast(approved ? '受取を確認しました' : '未払いに戻しました');
      } catch (error) {
        console.error('まとめて精算の受取確認エラー:', error);
        showAlert('error', '確認を保存できませんでした', error?.message || '画面を開き直して、もう一度お試しください。');
      } finally {
        settlementBusy.value = false;
      }
    },
    { type: approved ? 'info' : 'warning', confirmText: approved ? '確定する' : '確認できない', cancelText: 'やめる' },
  );
};

onMounted(async () => {
  // 🌟 自分の表示名を取得（履歴表示と参加者名に使用）
  const me = auth.currentUser;
  if (me) {
    try {
      const md = await getDoc(doc(db, "users", me.uid));
      myName.value = (md.exists() && md.data().name) ? md.data().name : await getMyName();
    } catch (e) { myName.value = await getMyName(); }
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
      eventData.value.activeEventSettlementPlanId = data.activeEventSettlementPlanId || null;
      eventData.value.lastEventSettlementPlanId = data.lastEventSettlementPlanId || null;
      subscribeSettlementPlan(eventData.value.activeEventSettlementPlanId || eventData.value.lastEventSettlementPlanId);
      eventData.value.invitationCode = data.invitationCode || "------";
      eventData.value.leaderUid = data.leaderUid || null;
      eventData.value.locked = !!data.locked;

      // 参加者情報の取得（名前＋アイコンを実データから）
      const uids = data.participants || [];
      const detailed = await Promise.all(uids.map(async (uid) => {
        const info = await getUserInfo(uid);
        return { id: uid, name: info.name, photo: info.photo, isMe: uid === auth.currentUser?.uid };
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

  unsubHistory = onSnapshot(q, (snapshot) => {
    const fetched = [];
    snapshot.forEach((docu) => {
      const data = docu.data();
      fetched.push({
        id: docu.id,
        payer: data.payer,
        itemName: data.itemName,
        splitType: data.splitType,
        amount: data.amount,
        color: data.color || '#fca5a5',
        date: data.date,
        time: data.time,
        status: data.status || 'unpaid', // 取引が読めるまでの控え（正は transactions 側）
        transactionIds: data.transactionIds || [],
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
    rawHistory.value = fetched;
    historyLoaded.value = true;
  }, (err) => {
    // イベント削除後や参加者でない場合は静かに無視（未購読解除の残骸対策）
    if (err?.code !== 'permission-denied') console.error("履歴監視エラー:", err);
  });

  // --- C. このイベントの取引(transactions)を監視 ---
  // 🌟 精算の正データは transactions。以前はここを履歴の更新時に1回読むだけだったので、
  //    お知らせからの承認や、相手の端末での完了が画面に反映されず、
  //    「未払いと出ているのに、押すと対象が見つからない」状態になっていた。
  //    複合インデックスを避けるため eventId の単一条件で取得し、絞り込みはJS側で行う。
  unsubTx = onSnapshot(query(collection(db, "transactions"), where("eventId", "==", eventId)), (snap) => {
    const map = {};
    snap.forEach((d) => {
      const t = d.data();
      map[d.id] = {
        id: d.id,
        status: t.status || 'unpaid',
        paidById: t.paidById || null,
        paidToId: t.paidToId || null,
        amount: Number(t.amount) || 0,
        itemName: t.itemName || '',
        historyId: t.historyId || null,
        syntheticSettlement: !!t.syntheticSettlement,
        eventSettlementPlanId: t.eventSettlementPlanId || null,
      };
    });
    txById.value = map;
    txLoaded.value = true;
  }, (err) => {
    if (err?.code !== 'permission-denied') console.error("取引監視エラー:", err);
  });
});

// 🌟 履歴と取引がそろったら、人ごとの精算状況を付けて画面のデータへ流し込む
watch([rawHistory, txById, txLoaded], () => {
  const decorated = rawHistory.value.map((h) => decorateHistory(h, txById.value, { loaded: txLoaded.value }));
  eventData.value.history = decorated;
  // 🌟 合計金額も履歴から再計算して反映
  eventData.value.total = decorated.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}, { deep: false });

// お知らせから開いた場合は、履歴を読み込んでから対象の1件を開く。
// 使用済みのqueryを消し、履歴の再描画で同じ詳細を開き直さない。
let notificationHistoryOpened = false;
watch([
  () => route.query.history,
  historyLoaded,
  rawHistory,
], async ([request, loaded]) => {
  const historyId = Array.isArray(request) ? request[0] : request;
  if (!historyId) { notificationHistoryOpened = false; return; }
  if (!loaded || notificationHistoryOpened) return;
  notificationHistoryOpened = true;
  await nextTick();
  const history = eventData.value.history.find((item) => item.id === historyId);
  if (history) {
    openHistoryDetail(history);
  } else {
    showAlert('info', '立て替え履歴が見つかりません', '削除されたか、現在は表示できない履歴です。');
  }
  const { history: _history, ...query } = route.query;
  try {
    await router.replace({ query });
  } catch (error) {
    console.error('履歴詳細のURL更新に失敗:', error);
  }
}, { immediate: true });

// リスナーの購読解除（画面離脱・イベント削除時のリーク／権限エラー防止）
const unsubscribeAll = () => {
  if (unsubEvent) { unsubEvent(); unsubEvent = null; }
  if (unsubHistory) { unsubHistory(); unsubHistory = null; }
  if (unsubTx) { unsubTx(); unsubTx = null; }
  clearSettlementSubscriptions();
};
onUnmounted(unsubscribeAll);
onUnmounted(() => setPaymentAvailability(null));

const deleteEventCompletely = async (reason) => {
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
          userMessage: reason || null,
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
  if (eventData.value.ended !== false) return;
  // 未精算が残っていたら、まず精算へ誘導（終了は精算完了が条件）
  if (unpaidItems.value.length > 0 || hasUnpaidTransactions.value || eventData.value.activeEventSettlementPlanId) {
    modals.value.unpaidWarning = true;
    return;
  }
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

const reopening = ref(false);
const handleReopenEvent = () => {
  if (!eventData.value.ended || reopening.value) return;
  showConfirm(
    'イベントを再開しますか？',
    '参加者全員が支払いを追加できる状態に戻します。立て替え履歴と精算済みの記録はそのまま残ります。',
    async () => {
      if (!eventData.value.ended || reopening.value) return;
      reopening.value = true;
      try {
        await updateDoc(doc(db, 'events', route.params.id), { ended: false, endedAt: null });
        eventData.value.ended = false;
        showToast('イベントを再開しました');
      } catch (e) {
        console.error('イベント再開エラー:', e);
        showAlert('error', '再開できませんでした', '通信状況を確認して、もう一度お試しください。精算の記録は変更していません。');
      } finally {
        reopening.value = false;
      }
    },
    { type: 'info', confirmText: '再開する', cancelText: 'やめる' }
  );
};

// 🌟 イベントの「削除」＝自分の画面から非表示（ゴミ箱に入り7日以内は復元可）
const handleDeleteEvent = () => {
  showConfirm(
    'イベントを削除しますか？',
    'このイベントを自分の画面から削除します。ゴミ箱に入り、7日以内なら復元できます（相手の画面には残ります）。',
    (reason) => deleteEventCompletely(reason),
    { type: 'error', confirmText: '削除する', cancelText: 'やめる', withReason: true, reasonPlaceholder: '削除の理由を書けます（任意・参加者に届きます）' }
  );
};

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
.content { padding: 15px 20px 24px; flex: 1; min-width: 0; }
.event-page-header :deep(.pagehead__title) { min-width: 0; overflow-wrap: anywhere; }

.summary-card { background: white; border-radius: 20px; padding: 20px; box-shadow: var(--shadow-card); margin-bottom: 24px; border: 1px solid var(--c-surface-2); }
.event-genre { display: inline-flex; color: var(--c-brand); margin-right: 6px; }
.event-genre :deep(svg) { width: 20px; height: 20px; }
.event-edit-btn { flex-shrink: 0; min-height: 40px; font-size: 12px; font-weight: var(--fw-bold); color: var(--c-brand-strong, var(--c-brand)); background: var(--c-brand-weak); border: none; padding: 8px; border-radius: 12px; cursor: pointer; transition: 0.2s; }
.event-edit-btn:active { transform: scale(0.95); }

.total-section { text-align: center; }
.label { font-size: 13px; color: var(--c-text-sub); font-weight: 800; display: flex; justify-content: center; align-items: center; margin-bottom: 8px; }
.total-amount { font-size: clamp(30px, 9vw, 48px); font-weight: 900; margin: 0; color: var(--c-ink); letter-spacing: -1.5px; overflow-wrap: anywhere; }
.total-sub { display: block; font-size: 12px; font-weight: 800; color: var(--c-text-faint); margin-top: 6px; }
.progress-wrap { margin-top: 14px; }
.progress-bar { height: 8px; background: var(--c-line-bold); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-brand); border-radius: 999px; transition: width 0.4s ease; }
.progress-text { display: block; font-size: 11px; font-weight: 800; color: var(--c-text-sub); margin-top: 6px; }

/* （これ以降のCSSは既存のままでOKです） */

.participants-card { margin: 24px 0; }
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

/* 鍵付き（承認制）の表示とリーダー用の切り替え */
.lock-bar { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 0 4px; }
.lock-chip { display: inline-flex; align-items: center; gap: 5px; background: var(--c-brand-weak); color: var(--c-brand-strong, var(--c-brand)); padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
.lock-note { flex: 1; font-size: 11px; font-weight: 700; color: var(--c-text-faint); }
.lock-toggle { margin-left: auto; background: none; border: 1px solid var(--c-line-bold); color: var(--c-text-sub); padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; cursor: pointer; }
.lock-toggle:active { transform: scale(0.95); }

.section-title { font-size: 18px; font-weight: 900; color: var(--c-ink); margin: 0 0 16px 0; }
.section-header { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header .section-title { margin: 0; }
.settlement-heading-row { display: block; }
.settlement-title-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-note { margin: 5px 0 0; font-size: 11px; line-height: 1.5; font-weight: 700; color: var(--c-text-sub); }
.start-settlement-btn { flex-shrink: 0; border: none; border-radius: 12px; padding: 9px 12px; background: var(--c-brand); color: #fff; font-size: 12px; font-weight: 800; cursor: pointer; }
.start-settlement-btn.refresh { background: var(--c-brand-strong); }
.start-settlement-btn:disabled { opacity: 0.6; cursor: wait; }
.settlement-filters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 10px; padding: 3px; border-radius: 12px; background: var(--c-line-bold); }
.settlement-filters button { min-width: 0; border: 0; border-radius: 9px; padding: 7px 6px; background: transparent; color: var(--c-text-sub); font-size: 11px; font-weight: 800; cursor: pointer; }
.settlement-filters button.active { background: #fff; color: var(--c-ink); box-shadow: 0 1px 5px rgba(15, 23, 42, 0.08); }
.settlement-error { margin-bottom: 12px; padding: 12px; border-radius: 12px; background: var(--c-danger-weak); color: var(--c-danger-strong); font-size: 12px; font-weight: 700; }
.add-payment-btn { background: var(--c-brand); color: white; border: none; padding: 12px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 12px rgba(5,150,105,0.25); transition: 0.2s; }
.add-payment-btn:active { transform: scale(0.95); }
.add-payment-btn:disabled { background: var(--c-surface-2); color: var(--c-text-sub); box-shadow: none; cursor: not-allowed; transform: none; }
.settlement-summary-section, .history-section { margin-bottom: 36px; }

.filter-wrapper { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.ios-segmented-control { display: flex; flex: 1 0 120px; background: var(--c-line-bold); border-radius: 12px; padding: 3px; }
.ios-segmented-control button { flex: 1; padding: 8px 0; border: none; background: transparent; font-weight: 800; font-size: 12px; color: var(--c-text-sub); border-radius: 10px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.ios-segmented-control button.active { background: white; color: var(--c-ink); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.custom-select-wrapper { flex: 1 0 110px; position: relative; }
.custom-select-wrapper.auto-width { flex: 1 0 110px; }
.ios-select { width: 100%; padding: 0 28px 0 12px; border-radius: 12px; border: 1px solid var(--c-line-strong); background: white; font-size: 12px; font-weight: 800; color: var(--c-text); outline: none; height: 100%; min-height: 36px; appearance: none; -webkit-appearance: none; cursor: pointer; }
.custom-select-wrapper::after { content: '▾'; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 10px; color: var(--c-text-faint); pointer-events: none; }

.summary-list, .timeline { display: flex; flex-direction: column; gap: 12px; }
.empty-state { text-align: center; font-size: 13px; color: var(--c-text-faint); font-weight: 800; padding: 30px; background: white; border-radius: 20px; border: 2px dashed var(--c-line-bold); }
.summary-card-item { width: 100%; background: white; border-radius: 16px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 10px; box-shadow: var(--shadow-card); cursor: pointer; transition: 0.2s; border: 1px solid transparent; text-align: left; font: inherit; color: inherit; }
.summary-card-item:active { transform: scale(0.98); border-color: var(--c-line); }
.summary-card-item.completed { background: var(--c-surface-2); box-shadow: none; opacity: 0.72; }
.flow { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; }
.avatar-small { width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; }
.name { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text); max-width: 64px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arrow-right { color: var(--c-text-faint); font-size: 12px; font-weight: bold; flex-shrink: 0; }
.amount-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.amount { font-size: 18px; font-weight: 900; display: flex; align-items: center; gap: 6px; }
.blue-text { color: var(--c-receive); } .orange-text { color: var(--c-pay-strong); }
/* 自分が関係しない（他人同士の）貸し借りは、受取・支払のどちらの色にもしない */
.muted-text { color: var(--c-text-sub); }
.arrow-icon { font-size: 16px; color: var(--c-line-strong); }

.timeline { position: relative; padding-left: 12px; }
.timeline-item { position: relative; margin-bottom: 0; cursor: pointer; display: flex; align-items: stretch; }
.timeline-line { position: absolute; left: 6px; top: 24px; bottom: -12px; width: 2px; background-color: var(--c-line-bold); z-index: 1; }
.timeline-item:last-child .timeline-line { display: none; }
.timeline-dot { background: var(--c-line-strong); position: absolute; left: 0; top: 20px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid #f4f7f9; z-index: 2; box-shadow: 0 0 0 1px var(--c-line-bold); }
/* min-width:0 が無いと、中身の最小幅がそのまま効いてカードが画面右にはみ出す */
.timeline-content { padding-left: 28px; flex: 1; min-width: 0; }

.history-card { background: white; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: 0.2s; border: 1px solid transparent; }
.history-card:active { transform: scale(0.98); }
.unpaid-card { border-color: var(--c-line-bold); }

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
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* 幅が足りなければバッジを次の行に落とす（切らない） */
  gap: 4px 6px;
  min-width: 0; /* 中身の最小幅で押し広げられないようにする */
}
/* 省略（…）は名前だけに効かせる。バッジまで一緒に切られないようにする */
.history-item-title {
  flex: 1 1 auto;
  min-width: 5em; /* 名前を優先し、狭いときはバッジが下へ回る */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.split-type {
  font-size: 10px;
  color: var(--c-text-sub);
  font-weight: 700;
  background: var(--c-surface-2);
  padding: 2px 6px;
  border-radius: 6px;
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
.history-payer { font-size: 11px; color: var(--c-text-sub); font-weight: 700; }
.history-price { font-size: 18px; font-weight: 900; color: var(--c-ink); letter-spacing: -0.5px; }
.pay-now-btn { background: var(--c-danger); color: white; border: none; padding: 6px 12px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; box-shadow: 0 2px 8px rgba(239,68,68,0.2); transition: 0.2s; }
.pay-now-btn:active { transform: scale(0.95); }

.badge { font-size: 10px; padding: 4px 10px; border-radius: 12px; font-weight: 800; }
.paid { background: var(--c-surface-2); color: var(--c-text-sub); }
.badge.receive { background: var(--c-receive-weak); color: var(--c-receive-strong); }
.badge.owe { background: var(--c-pay-weak); color: var(--c-pay-strong); }
.badge.pending { background: var(--c-surface-2); color: var(--c-text-faint); }
/* 申請済み（相手の承認待ち）＝もう一度申請しないように分けて出す */
.badge.waiting { background: var(--c-surface-2); color: var(--c-text-sub); }
.badge.preview { background: var(--c-brand-weak); color: var(--c-brand-strong, var(--c-brand)); }
.history-right .badge.waiting { background: var(--c-pay-weak); color: var(--c-pay-strong); }
/* 他人同士の精算＝自分のお金は動かない */
.badge.others { background: var(--c-surface-2); color: var(--c-text-sub); }
/* 一部だけ精算が済んでいる立て替え（例 1/2人 精算済み） */
.badge.progress { background: var(--c-surface-2); color: var(--c-text-sub); }

.event-actions { display: grid; gap: 8px; }
.event-actions .end-hint { margin: 0 0 8px; text-align: left; }
.event-actions .end-hint:last-child { margin-bottom: 0; }
.end-event-btn { width: 100%; background-color: var(--c-ink); color: white; border: none; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.end-event-btn:active { transform: scale(0.96); }
.end-event-btn:disabled { opacity: 0.6; cursor: wait; }
.end-hint { font-size: 11px; color: var(--c-text-faint); text-align: center; margin: 0 0 18px; font-weight: 700; }

/* 🌟 削除（ゴミ箱行き）は終了と明確に区別 */
.delete-event-btn { width: 100%; background: #fff; color: var(--c-danger-strong); border: 1.5px solid #fecaca; padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.delete-event-btn:active { transform: scale(0.96); background: var(--c-danger-weak); }

/* 🌟 終了済み表示 */
.ended-chip { width: 100%; background: var(--c-brand-weak); color: var(--c-brand); border: 1.5px solid #a7f3d0; padding: 10px; border-radius: 12px; font-size: 12px; font-weight: 800; text-align: center; margin: 0; box-sizing: border-box; }

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
.leader-badge { font-size: 10px; background: var(--c-brand-weak); color: var(--c-brand-strong, var(--c-brand)); padding: 2px 8px; border-radius: 10px; font-weight: 800; }
.p-remove-btn { flex-shrink: 0; width: 34px; height: 34px; border: none; background: var(--c-danger-weak); color: var(--c-danger); border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.p-remove-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.p-remove-btn:active { transform: scale(0.92); }
.p-remove-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

/* 🌟 イベント編集モーダル */
.edit-body { display: flex; flex-direction: column; }
.edit-label { font-size: 12px; font-weight: 800; color: var(--c-text-sub); margin-bottom: 8px; }
.edit-input { width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--c-line-bold); background: var(--c-surface-2); font-size: 16px; /* 16px未満にするとiOSで入力時に画面が拡大する */ font-weight: 800; color: var(--c-ink); outline: none; box-sizing: border-box; margin-bottom: 20px; }
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

.settlement-detail-modal {
  padding: 22px 20px max(24px, env(safe-area-inset-bottom));
  overscroll-behavior: contain;
}
.settlement-detail-modal .modal-header { margin-bottom: 18px; }
.summary-detail-body { text-align: center; padding: 0; }
.summary-route { display: grid; grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr); align-items: start; gap: 6px; margin: 0 auto 14px; }
.summary-person { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.summary-person-name { min-width: 0; min-height: 32px; max-width: 112px; display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--c-text-strong); font-size: 12px; line-height: 1.35; font-weight: 800; text-align: center; }
.summary-arrow { margin-top: 10px; color: var(--c-line-strong); font-size: 20px; line-height: 20px; font-weight: 900; }
.s-amount { max-width: 100%; overflow-wrap: anywhere; font-size: clamp(28px, 10vw, 40px); line-height: 1.08; font-weight: 900; margin: 0 0 10px; letter-spacing: -1px; }
.s-hint { font-size: 12px; color: var(--c-text-faint); margin: 16px 0; font-weight: 700; }
.s-role { display: inline-flex; align-items: center; min-height: 26px; margin: 0; padding: 0 11px; border-radius: 999px; background: var(--c-surface-2); color: var(--c-text-sub); font-size: 11px; font-weight: 900; }
.action-btn { width: 100%; padding: 18px; border-radius: 20px; border: none; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.2s; }
.action-btn.main { background: var(--c-brand); color: white; box-shadow: 0 8px 20px rgba(5,150,105,0.25); }
.action-btn.main:active { transform: scale(0.96); }
.action-btn:disabled { opacity: 0.6; cursor: wait; }
.receipt-actions { display: grid; gap: 8px; }
.receipt-actions .action-btn { padding: 12px; border-radius: 12px; font-size: 14px; }
.action-btn.reject { background: #fff; color: var(--c-danger-strong); border: 1px solid #fecaca; }

.warning-modal { background: var(--c-danger-weak); }
.warning-title { color: var(--c-danger) !important; }
.warning-desc { font-size: 15px; color: var(--c-text-strong); font-weight: 800; margin-bottom: 24px; line-height: 1.6; }
.warning-actions { display: flex; flex-direction: column; gap: 12px; }
.danger-btn { background: var(--c-danger); color: white; border: none; padding: 18px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 8px 20px rgba(239,68,68,0.25); }
.safe-btn { background: white; color: var(--c-text-strong); border: 2px solid var(--c-line-strong); padding: 16px; border-radius: 20px; font-weight: 900; font-size: 16px; cursor: pointer; }

.completed-section { margin: 16px 0 0; }
.completed-card { display: flex; align-items: center; justify-content: center; gap: 6px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 10px; color: #166534; }
.completed-icon { display: flex; }
.completed-title { font-size: 13px; font-weight: 900; margin: 0; }

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

/* まとめて精算の根拠は必要なときだけ開く */
.breakdown-wrap { margin: 18px 0 0; }
.breakdown-toggle { width: 100%; min-height: 42px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border: 1px solid var(--c-line-bold); border-radius: 12px; background: #fff; color: var(--c-text-sub); font-size: 12px; font-weight: 800; cursor: pointer; }
.breakdown-chevron { font-size: 18px; line-height: 1; transform: rotate(0); transition: transform 0.15s ease; }
.breakdown-chevron.open { transform: rotate(180deg); }
.breakdown-list {
  background: var(--c-surface-2);
  border-radius: 12px;
  padding: 12px 14px;
  margin: 8px 0 0;
  text-align: left;
  border: 1px solid var(--c-line-bold);
}
.breakdown-item {
  min-width: 0;
  padding: 11px 0;
  border-bottom: 1px solid var(--c-line-bold);
}
.breakdown-item:last-child {
  padding-bottom: 2px;
  border-bottom: 0;
}
.breakdown-item:first-child {
  padding-top: 2px;
}
.bd-name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
  color: var(--c-text);
}
.bd-right {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
}
.bd-who {
  min-width: 0;
  flex: 1;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 10px;
  line-height: 1.4;
  color: var(--c-text-faint);
  font-weight: 800;
}
.bd-amount {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 900;
  color: var(--c-ink);
}
.summary-start-btn {
  margin-top: 16px;
  padding: 14px 12px;
  border-radius: 14px;
  font-size: 14px;
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
@media (max-width: 480px) {
  .history-card { flex-wrap: wrap; gap: 8px; padding: 12px; border-radius: 14px; }
  .history-main { flex-basis: 100%; }
  .summary-card-item { padding: 11px 12px; flex-direction: column; align-items: stretch; gap: 7px; }
  .summary-card-item .flow { width: 100%; gap: 5px; }
  .summary-card-item .name {
    flex: 1;
    min-width: 0;
    max-width: none;
    font-size: 12px;
    line-height: 1.35;
  }
  .summary-card-item .amount-right {
    width: 100%;
    min-width: 0;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .summary-card-item .amount { font-size: 17px; }
  .history-right { flex: 1 0 100%; margin-left: 0; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
  .history-price { margin-right: auto; }
  .history-main { gap: 8px; }
  .history-right .badge { padding: 3px 7px; }
  .history-right .badge.progress { margin-left: auto; }
  .history-payer { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .history-item-title { flex-basis: 100%; }
  .history-item-title { min-width: 0; }
  .participants-row { flex-wrap: wrap; gap: 12px; }
  .lock-bar { flex-wrap: wrap; }
  .icb-code { min-width: 0; letter-spacing: 2px; overflow-wrap: anywhere; }
  .icb-copy { padding: 8px 10px; }
}
</style>
