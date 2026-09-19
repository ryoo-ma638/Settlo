<template>
  <div class="trash">
    <PageHeader title="元に戻す" fallback="/mypage" />

    <div class="trash__body">
      <div class="ttabs">
        <!-- 取引だけを扱う。隠したイベントはイベント一覧から戻す。 -->
        <button class="ttab" :class="{ 'is-on': tab === 'restore' }" @click="tab = 'restore'">
          <svg class="ttab__icon" viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V10h5.5"/></svg>
          <span>復元できる取引</span>
          <span v-if="restoreItems.length" class="ttab__cnt">{{ restoreItems.length }}</span>
        </button>
        <button class="ttab" :class="{ 'is-on': tab === 'pending' }" @click="tab = 'pending'">
          <svg class="ttab__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
          <span>確認中</span>
          <span v-if="pendingItems.length" class="ttab__cnt">{{ pendingItems.length }}</span>
        </button>
        <button class="ttab" :class="{ 'is-on': tab === 'notice' }" @click="tab = 'notice'">
          <svg class="ttab__icon" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
          <span>お知らせ</span>
          <span v-if="noticeItems.length" class="ttab__cnt">{{ noticeItems.length }}</span>
        </button>
      </div>

      <p class="hint">{{ tabHint }}</p>
      <p v-if="loadError" class="load-error" role="alert">{{ loadError }}</p>
      <p v-if="actionError" class="load-error" role="alert">{{ actionError }}</p>

      <!-- 消したお知らせ -->
      <div v-if="tab === 'notice'" class="list">
        <div v-if="loading" class="empty">読み込み中…</div>
        <div v-else-if="noticeItems.length === 0" class="empty">消したお知らせはありません</div>
        <div v-for="n in noticeItems" :key="n.id" class="tcard">
          <div class="tcard__main">
            <p class="tcard__title">{{ noticeTitle(n) }}</p>
            <dl v-if="detailOf(n).rows.length" class="ndetail">
              <div v-for="row in detailOf(n).rows" :key="row.label">
                <dt>{{ row.label }}</dt><dd>{{ row.value }}</dd>
              </div>
            </dl>
            <p v-if="detailOf(n).note" class="tcard__sub">{{ detailOf(n).note }}</p>
            <p class="tcard__sub">{{ noticeRemainText(n) }}</p>
          </div>
          <!-- 消したあとに状況が変わっていることがある。押せるかどうかを先に見せる -->
          <p v-if="actionOf(n).reason" class="ndetail__why" :class="{ 'is-block': !actionOf(n).can }">
            {{ actionOf(n).reason }}
          </p>
          <div class="tcard__actions">
            <button
              v-if="actionOf(n).can"
              class="tbtn"
              :disabled="busyId === n.id"
              @click="resumeNotice(n)"
            >{{ actionLabelOf(n) }}</button>
            <button v-else-if="noticeChecked(n)" class="tbtn tbtn--disabled" disabled>手続きできません</button>
            <button class="tbtn tbtn--ghost" :disabled="busyId === n.id" @click="deleteNotice(n)">完全に削除</button>
          </div>
        </div>
      </div>

      <!-- イベント / 取引 タブ（削除・完了したもの） -->
      <div v-else-if="tab === 'restore'" class="list">
        <template v-if="loading">
          <div v-for="n in 3" :key="'sk' + n" class="tcard tcard--sk">
            <div class="tcard__head">
              <span class="skeleton skeleton--text" style="width:60px;height:18px"></span>
              <span class="skeleton skeleton--text" style="width:44px;height:14px"></span>
            </div>
            <div class="skeleton skeleton--text" style="width:65%;height:16px;margin:8px 0 6px"></div>
            <div class="skeleton skeleton--text" style="width:40%;height:12px"></div>
            <div class="skeleton" style="height:40px;margin-top:14px;border-radius:12px"></div>
          </div>
        </template>
        <div v-if="!loading && currentItems.length === 0" class="empty">
          <span class="empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
              <path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </span>
          <p>復元できる取引はありません</p>
        </div>

        <div v-for="item in currentItems" :key="item._loc + item.id" class="tcard">
          <div class="tcard__head">
            <span class="tcard__badge" :class="item.type === 'event' ? 'is-event' : 'is-pay'">{{ typeLabel(item.type) }}</span>
            <span class="tcard__days" :class="{ 'is-soon': daysLeft(item) <= 2 }">あと{{ daysLeft(item) }}日</span>
          </div>
          <p class="tcard__ttl">{{ item.type === 'event' ? item.eventName : item.itemName }}</p>
          <p class="tcard__meta">
            <template v-if="item.type === 'event'">ジャンル：{{ item.eventTag || 'その他' }}</template>
            <template v-else><b class="yen">¥{{ (item.amount || 0).toLocaleString() }}</b><span class="sep">/</span>{{ item.eventName }}</template>
          </p>
          <p class="tcard__note" v-if="item._loc === 'shared' && item.createdBy && item.createdBy !== myUid">
            {{ item.createdByName || '相手' }}さんが{{ item.type === 'payment' ? '削除' : '完了に' }}しました
          </p>
          <p v-if="item.type !== 'event'" class="tcard__record-note">共有するお金の記録は、この画面から消せません。</p>
          <p v-if="item._loc === 'shared' && item.type !== 'event'" class="tcard__record-note">相手と共有している記録です。ここからは戻せません。相手のお知らせで「正しくない」を選んでもらうと元に戻せます。</p>
          <!-- 共有の取引はボタンが1つも出ないので、空の箱で余白だけ残さない -->
          <div class="tcard__actions" v-if="item.type === 'event' || item._loc !== 'shared'">
            <button v-if="item.type === 'event'" class="btn-brand act" @click="askRestoreEvent(item)">表示を戻す</button>
            <button v-else-if="item.type === 'payment' && item._loc !== 'shared'" class="btn-brand act" @click="askRestorePayment(item)">取引を復元</button>
            <button v-else-if="item.type !== 'event' && item._loc !== 'shared'" class="btn-brand act" @click="askRestoreSettlement(item)">未精算へ戻す</button>
            <button v-if="item.type === 'event'" class="btn-outline act" @click="askDeleteForever(item)">記録を削除</button>
          </div>
        </div>
      </div>

      <!-- 保留タブ（相手の承認待ち） -->
      <div v-else class="list">
        <div v-if="!loading && pendingItems.length === 0" class="empty">
          <span class="empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
            </svg>
          </span>
          <p>保留中のものはありません</p>
        </div>

        <div v-for="item in pendingItems" :key="item._loc + item.id" class="tcard tcard--wait">
          <div class="tcard__head">
            <span class="tcard__badge is-wait">{{ item.status === 'restored' ? '復元の確認待ち' : '承認待ち' }}</span>
            <span class="tcard__days" :class="{ 'is-soon': daysLeft(item) <= 2 }">あと{{ daysLeft(item) }}日</span>
          </div>
          <p class="tcard__ttl">{{ item.type === 'event' ? item.eventName : item.itemName }}</p>
          <p class="tcard__meta">
            <template v-if="item.type === 'event'">ジャンル：{{ item.eventTag || 'その他' }}</template>
            <template v-else><b class="yen">¥{{ (item.amount || 0).toLocaleString() }}</b><span class="sep">/</span>{{ item.eventName }}</template>
          </p>
          <p class="tcard__note" v-if="item.status === 'restored'">
            {{ item.restoredBy === myUid ? '元に戻しました。相手が「正しくない」を選ぶと、削除した状態に戻ります' : `${item.createdByName || '相手'}さんが元に戻しました。お知らせから「正しい／正しくない」を選んでください` }}
          </p>
          <p class="tcard__note" v-else>相手（{{ counterpartyNames(item) }}）の承認を待っています</p>
          <p v-if="item._loc === 'shared'" class="tcard__record-note">相手と共有している記録のため、この画面からは取り消せません。</p>
          <div class="tcard__actions" v-if="item.status === 'pending' && item._loc !== 'shared'">
            <button class="btn-outline act" @click="askCancelPending(item)">依頼を取り消す</button>
          </div>
        </div>
      </div>

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
        @confirm="handleConfirm"
        @cancel="alertState.show = false"
        @close="alertState.show = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import { db, auth } from '@/firebase';
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc,
  setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, arrayRemove, increment
} from 'firebase/firestore';
import PageHeader from '@/components/PageHeader.vue';
import BaseModal from '@/components/BaseModal.vue';
import { notificationDetail } from '@/lib/notificationDetail';
import { noticeActionState, noticeActionLabel } from '@/lib/noticeAction';
import { useRouter } from 'vue-router';

// 消したお知らせの見出し。種類ごとの言い方をここに集める。
const NOTICE_LABEL = {
  payment_reminder: 'からの催促',
  approval_request: 'からの承認のお願い',
  payment_completed: 'との精算の連絡',
  payment_added: 'が追加した立て替え',
  payment_edited: 'が変えた立て替え',
  payment_deleted: 'が消した立て替え',
  friend_request: 'からのフレンド申請',
  friend_approved: 'とフレンドになった知らせ',
  thread_reply: 'からの返信',
  event_invite: 'からのイベントの招待',
  event_settlement_started: 'が始めたまとめて精算',
  event_settlement_approval_request: 'からのまとめて精算の受取確認',
};

const tab = ref('restore');
const userItems = ref([]);   // 自分専用（イベントの非表示など）
const sharedItems = ref([]); // 共有ゴミ箱（取引・両当事者が見られる）
const loading = ref(true);   // 初回読込中は true（スケルトン表示）
const loadError = ref('');
const actionError = ref('');
const router = useRouter();
const myName = ref('メンバー');
const myUid = ref('');
let unsubUser = null;
let unsubNotice = null;
let unsubShared = null;

// 2つのゴミ箱を新しい順にまとめる
const items = computed(() => {
  const all = [
    ...userItems.value.map(i => ({ ...i, _loc: 'user' })),
    ...sharedItems.value.map(i => ({ ...i, _loc: 'shared' })),
  ];
  return all.sort((a, b) => (b.trashedAt?.seconds || 0) - (a.trashedAt?.seconds || 0));
});

// 保留＝相手の承認待ち(pending) or 復元後の相手確認待ち(restored)
const trashedItems = computed(() => items.value.filter(i => i.status !== 'pending' && i.status !== 'restored'));
const pendingItems = computed(() => items.value.filter(i => i.status === 'pending' || i.status === 'restored'));
// 一覧から隠したイベントは、イベント一覧の「非表示にしたイベント」から戻す。
// ここは名前のとおり取引だけを扱う。
const restoreItems = computed(() => trashedItems.value.filter(i => i.type !== 'event'));
const currentItems = computed(() => restoreItems.value);
const tabHint = computed(() => {
  if (tab.value === 'restore') return '削除した立て替えの復元と、精算済みを未精算へ戻す依頼を行います。共有する記録は手動で消せません。';
  if (tab.value === 'notice') return '過去のお知らせから消したものです。ここに入って7日で自動的に消えます。すぐ消すこともできます。';
  return '相手の確認を待っている操作です。ここから同じ操作を繰り返すことはできません。元の削除日から7日で自動的に整理されます。';
});

// ---- 消したお知らせ ----
const notices = ref([]);
const busyId = ref('');
const noticeItems = computed(() => [...notices.value]
  .sort((a, b) => (b.trashedAt?.seconds || 0) - (a.trashedAt?.seconds || 0)));
// お知らせのタブを開いたときに、対象の取引・イベントを確かめる
watch([() => tab.value, noticeItems], ([t, list]) => {
  if (t !== 'notice') return;
  list.forEach((n) => { loadNoticeTarget(n); });
}, { immediate: true });
const detailOf = (n) => notificationDetail(n);
const noticeTitle = (n) => {
  const who = n.fromUserName ? `${n.fromUserName}さん` : '';
  return `${who}${NOTICE_LABEL[n.type] || 'からのお知らせ'}`;
};
// ここに入ってから7日。残りを日で伝える
const noticeRemainText = (n) => {
  const ms = n.trashedAt?.toMillis ? n.trashedAt.toMillis() : null;
  if (ms === null) return '自動で消える日は、次の整理のときに決まります';
  const left = Math.ceil((ms + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000));
  if (left <= 0) return 'まもなく自動で消えます';
  return `あと${left}日で自動的に消えます`;
};
// 🌟 対象の取引とイベントを読んで、いま手続きできるかを決める。
//    読んだ結果は覚えておく（画面を開くたびに何度も引かない）。
const noticeTargets = reactive({});
const noticeChecked = (n) => Object.prototype.hasOwnProperty.call(noticeTargets, n.id);
const loadNoticeTarget = async (n) => {
  if (noticeChecked(n)) return;
  noticeTargets[n.id] = { transaction: null, event: null };
  try {
    if (n.transactionId) {
      const snap = await getDoc(doc(db, 'transactions', n.transactionId));
      noticeTargets[n.id].transaction = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
    if (n.eventId) {
      const snap = await getDoc(doc(db, 'events', n.eventId));
      noticeTargets[n.id].event = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
  } catch (e) {
    console.error('お知らせの対象を確認できませんでした:', e);
  }
};
const actionOf = (n) => noticeActionState({
  notification: n,
  transaction: noticeTargets[n.id]?.transaction ?? null,
  event: noticeTargets[n.id]?.event ?? null,
});
const actionLabelOf = (n) => noticeActionLabel(actionOf(n));

// 手続きに戻す。お知らせ一覧へ戻したうえで、その件の画面へ連れて行く。
// お金を動かす操作そのものは、これまで使われている画面のボタンに任せる。
const resumeNotice = async (n) => {
  if (busyId.value) return;
  busyId.value = n.id;
  try {
    await updateDoc(doc(db, 'notifications', n.id), {
      inTrash: false, trashedAt: null, isRead: false, readAt: null,
    });
    const tx = noticeTargets[n.id]?.transaction;
    if (tx && tx.id) {
      const prefix = tx.paidById === myUid.value ? 'unpaid' : 'waiting';
      router.push(`/payment-detail/${prefix}-${tx.id}`);
      return;
    }
    if (n.eventId) { router.push(`/event/${n.eventId}`); return; }
    router.push('/');
  } catch (e) {
    console.error('手続きに戻せませんでした:', e);
    actionError.value = '手続きに戻せませんでした。通信状況を確認してください。';
  } finally {
    busyId.value = '';
  }
};

const deleteNotice = async (n) => {
  if (!n?.id || busyId.value) return;
  busyId.value = n.id;
  try {
    await deleteDoc(doc(db, 'notifications', n.id));
  } catch (e) {
    console.error('お知らせの削除に失敗:', e);
    actionError.value = 'お知らせを消せませんでした。通信状況を確認してください。';
  } finally {
    busyId.value = '';
  }
};

const itemUsesEventSettlement = (item) => (item?.transactionSnapshots || [])
  .some((transaction) => !!transaction?.eventSettlementPlanId);

// 項目がどちらのゴミ箱にあるかを見て正しい参照を返す
const trashRef = (item) => (item._loc === 'shared'
  ? doc(db, 'trash', item.id)
  : doc(db, 'users', auth.currentUser?.uid, 'trash', item.id));

const daysLeft = (item) => {
  const ms = item.trashedAt?.toMillis ? item.trashedAt.toMillis() : Date.now();
  const left = 7 - Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
  return Math.max(0, left);
};
const counterpartyNames = (item) => (item.counterparties || []).map(c => c.name).join('・') || '相手';
const typeLabel = (t) => (t === 'event' ? '非表示' : (t === 'payment' ? '削除した立替' : '精算済み'));

// ---- 確認ダイアログ ----
const alertState = reactive({ show: false, type: 'warning', title: '', message: '', showCancel: true, confirmText: 'はい', cancelText: 'いいえ', onConfirm: null, withReason: false, reasonPlaceholder: '' });
const askConfirm = (title, message, onConfirm, opts = {}) => {
  Object.assign(alertState, {
    type: opts.type || 'warning', title, message, showCancel: true,
    confirmText: opts.confirmText || 'はい', cancelText: opts.cancelText || 'いいえ',
    withReason: !!opts.withReason, reasonPlaceholder: opts.reasonPlaceholder || '理由を書けます（任意・相手に届きます）',
    onConfirm, show: true,
  });
};
// 🌟 確認モーダルの「確定」連打を防ぐ（復元＝取引の再作成が二重に走るのを防ぐ）
const restoreBusy = ref(false);
const handleConfirm = async (reason) => {
  if (restoreBusy.value) return;
  actionError.value = '';
  const cb = alertState.onConfirm;
  alertState.show = false;
  if (!cb) return;
  restoreBusy.value = true;
  try { await cb(reason); } finally { restoreBusy.value = false; }
};

// ---- 自分のイベント一覧へ表示を戻す ----
const askRestoreEvent = (item) => {
  askConfirm(
    'イベントを一覧に戻しますか？',
    `「${item.eventName || 'イベント'}」を自分のイベント一覧に再表示します。イベント本体や、ほかの参加者の一覧は変わりません。参加者への通知や確認依頼は送りません。`,
    () => restoreEvent(item),
    { confirmText: '表示を戻す', cancelText: 'やめる' }
  );
};
const askRestorePayment = (item) => {
  if (item._loc === 'shared') return;
  if (itemUsesEventSettlement(item)) {
    Object.assign(alertState, {
      type: 'info', title: 'まとめて精算に含まれています',
      message: 'この支払いだけを元に戻すことはできません。イベントのまとめて精算から記録を確認してください。',
      showCancel: false, confirmText: 'OK', onConfirm: null, show: true,
    });
    return;
  }
  askConfirm(
    '削除した取引を復元しますか？',
    `「${item.itemName || '支払い'}」（¥${Number(item.amount || 0).toLocaleString()}）の貸し借りを復元します。`,
    () => restorePayment(item),
    { confirmText: '取引を復元', cancelText: 'やめる' }
  );
};

const restoreEvent = async (item) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    // 自分の非表示を解除
    await updateDoc(doc(db, 'events', item.eventId), { hiddenBy: arrayRemove(uid) });
    await deleteDoc(doc(db, 'users', uid, 'trash', item.id));
  } catch (e) {
    console.error('イベント表示の復元エラー:', e);
    actionError.value = 'イベントを一覧へ戻せませんでした。通信状況を確認してください。';
  }
};

// ---- 旧形式の自分専用データだけを元に戻す ----
const restorePayment = async (item) => {
  if (item._loc === 'shared') return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    const eventId = item.eventId;
    const histRef = doc(collection(db, 'events', eventId, 'history'));
    const newTxIds = [];
    for (const tx of (item.transactionSnapshots || [])) {
      const ref = await addDoc(collection(db, 'transactions'), {
        ...tx,
        historyId: histRef.id,
        createdAt: serverTimestamp(),
      });
      newTxIds.push(ref.id);
    }
    const hs = item.historySnapshot || {};
    await setDoc(histRef, {
      ...hs, transactionIds: newTxIds, status: 'unpaid', timestamp: serverTimestamp(),
    });
    await updateDoc(doc(db, 'events', eventId), { totalAmount: increment(Number(item.amount) || 0) });
    await deleteDoc(trashRef(item));
  } catch (e) {
    console.error('支払い復元エラー:', e);
    actionError.value = '取引を復元できませんでした。通信状況を確認してください。';
  }
};

// ---- 決済を未精算に戻す（相手の承認待ちへ） ----
const askRestoreSettlement = (item) => {
  if (item._loc === 'shared') return;
  if (itemUsesEventSettlement(item)) {
    Object.assign(alertState, {
      type: 'info', title: 'まとめて精算で確定済みです',
      message: 'この支払いだけを未精算には戻せません。イベントのまとめて精算から記録を確認してください。',
      showCancel: false, confirmText: 'OK', onConfirm: null, show: true,
    });
    return;
  }
  askConfirm(
    '未精算へ戻す確認を依頼しますか？',
    `「${item.itemName}」（¥${Number(item.amount || 0).toLocaleString()}）を未精算へ戻すには相手の承認が必要です。承認されるまでは精算済みのままです。実際の送金は取り消されません。`,
    (reason) => requestSettlementRestore(item, reason),
    { confirmText: '確認を依頼', cancelText: 'やめる', withReason: true, reasonPlaceholder: '未精算へ戻したい理由を書けます（任意・相手に届きます）' }
  );
};
const requestSettlementRestore = async (item, reason) => {
  if (item._loc === 'shared') return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await updateDoc(trashRef(item), { status: 'pending' });
    for (const c of (item.counterparties || [])) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: c.uid, type: 'settlement_restore_request',
        trashId: null,
        eventId: item.eventId || null, eventName: item.eventName || '',
        historyId: item.historyId || null, itemName: item.itemName || '決済',
        amount: item.amount || 0, transactionIds: item.transactionIds || [],
        fromUserId: uid, fromUserName: myName.value,
        userMessage: reason || null,
        isRead: false, createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error('未精算戻し依頼エラー:', e);
    actionError.value = '確認を依頼できませんでした。通信状況を確認してください。';
  }
};

// ---- 保留の依頼を取り消す ----
const askCancelPending = (item) => {
  askConfirm('依頼を取り消しますか？', `「${item.itemName}」を未精算に戻す依頼を取り消します。`, async () => {
    try {
      await updateDoc(trashRef(item), { status: 'trashed' });
    } catch (e) {
      console.error(e);
      actionError.value = '依頼を取り消せませんでした。通信状況を確認してください。';
    }
  }, { confirmText: '取り消す', cancelText: 'やめる' });
};

// ---- 完全に削除（復元できなくする） ----
const askDeleteForever = (item) => {
  if (item.type !== 'event') return;
  askConfirm(
    '記録を削除しますか？',
    '自分用の非表示記録を消します。イベント本体や、ほかの参加者の一覧には影響しません。',
    async () => {
      try { await deleteDoc(trashRef(item)); } catch (e) { console.error(e); }
    },
    { type: 'error', confirmText: '記録を削除', cancelText: 'やめる' }
  );
};

onMounted(() => {
  const uid = auth.currentUser?.uid;
  if (!uid) { loading.value = false; return; }
  myUid.value = uid;
  getDoc(doc(db, 'users', uid)).then(md => {
    if (md.exists() && md.data().name) myName.value = md.data().name;
    else myName.value = auth.currentUser?.displayName || 'メンバー';
  }).catch(() => {});
  // 消したお知らせ（自分あて・ゴミ箱へ移したもの）
  const qNotice = query(collection(db, 'notifications'), where('toUserId', '==', uid));
  unsubNotice = onSnapshot(qNotice, (snap) => {
    notices.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(n => n.inTrash === true);
  }, (err) => {
    console.error('消したお知らせの読み込みエラー:', err);
  });
  // 自分専用ゴミ箱（イベントの非表示など）
  const qUser = query(collection(db, 'users', uid, 'trash'), orderBy('trashedAt', 'desc'));
  unsubUser = onSnapshot(qUser, (snap) => {
    userItems.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    loading.value = false;
  }, (err) => {
    loading.value = false;
    loadError.value = err?.code === 'permission-denied'
      ? 'イベントの非表示記録を確認できません。権限またはログイン状態を確認してください。'
      : '読み込めませんでした。通信状況を確認してください。';
    console.error('ゴミ箱の読み込みエラー:', err);
  });
  // 共有ゴミ箱（取引・自分が当事者のもの）
  const qShared = query(collection(db, 'trash'), where('participants', 'array-contains', uid));
  unsubShared = onSnapshot(qShared, (snap) => {
    sharedItems.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    loading.value = false;
  }, (err) => {
    loading.value = false;
    loadError.value = err?.code === 'permission-denied'
      ? '取引の復元記録を確認できません。権限またはログイン状態を確認してください。'
      : '取引の復元記録を読み込めませんでした。通信状況を確認してください。';
    console.error('共有ゴミ箱の読み込みエラー:', err);
  });
});
onUnmounted(() => { if (unsubUser) unsubUser(); if (unsubShared) unsubShared(); if (unsubNotice) unsubNotice(); });
</script>

<style scoped>
/* 外枠には左右の余白を付けない。共通の .screen を使うとヘッダーごと内側へ
   押し込まれ、他の画面と戻るボタンの位置がそろわなくなる。
   余白は本文だけに付ける（相談・履歴など他画面と同じ作り）。 */
.trash { padding-bottom: calc(var(--nav-h) + 28px); }
.trash__body { padding: 4px var(--pad) 0; }

/* タブ（はっきり見える大きめボタン） */
.ttabs {
  display: flex;
  gap: 8px;
  margin: 14px var(--pad) 12px;
}
.ttab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 4px 10px;
  border-radius: var(--r-lg, 16px);
  background: var(--c-surface);
  border: 1.5px solid var(--c-line, #e5e8eb);
  color: var(--c-text-sub);
  font-size: 13px;
  font-weight: var(--fw-bold);
  position: relative;
  transition: all 0.15s ease;
}
.ttab__icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ttab.is-on {
  background: var(--c-brand);
  border-color: var(--c-brand);
  color: #fff;
  box-shadow: 0 4px 12px rgba(16, 145, 90, 0.28);
}
.ttab:active { transform: scale(0.97); }
.ttab__cnt {
  position: absolute;
  top: -7px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--c-danger);
  color: #fff;
  font-size: 11px;
  font-weight: var(--fw-bold);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c-bg, #fff);
}

.hint { margin: 0 var(--pad) 14px; font-size: 12px; color: var(--c-text-sub); line-height: 1.5; }
.load-error { margin: 0 var(--pad) 14px; padding: 10px 12px; border: 1px solid #f1c5c5; border-radius: 10px; background: #fff8f8; color: var(--c-danger); font-size: 12px; line-height: 1.5; }
.list { padding: 0 var(--pad); display: flex; flex-direction: column; gap: 12px; }

/* 空表示 */
.empty { text-align: center; padding: 48px 20px; color: var(--c-text-sub); }
.empty__icon { display: block; margin-bottom: 10px; opacity: 0.6; line-height: 0; }
.empty__icon svg { width: 40px; height: 40px; }
.empty p { margin: 0; font-size: 14px; }

/* カード */
.tcard {
  background: var(--c-surface);
  border: 1px solid var(--c-line, #eef0f2);
  border-radius: var(--r-lg, 16px);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15,23,42,0.04));
}
.tcard--wait { border-color: #fde9c8; background: #fffdf8; }

.tcard__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tcard__badge { padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: var(--fw-bold); }
.tcard__badge.is-event { background: var(--c-brand-weak); color: var(--c-brand); }
.tcard__badge.is-pay { background: var(--c-pay-weak); color: var(--c-pay-strong); }
.tcard__badge.is-wait { background: var(--c-pay-weak); color: var(--c-pay-strong); }

.tcard__days { font-size: 11px; font-weight: var(--fw-bold); color: var(--c-text-sub); background: var(--c-surface-2, #f4f5f7); padding: 3px 9px; border-radius: 999px; }
.tcard__days.is-soon { background: #fdecec; color: var(--c-danger); }

.tcard__ttl { margin: 0; font-weight: var(--fw-bold); font-size: 16px; color: var(--c-ink); word-break: break-word; line-height: 1.35; }
.tcard__meta { margin: 3px 0 0; font-size: 13px; color: var(--c-text-sub); }
.tcard__meta .yen { color: var(--c-ink); font-weight: var(--fw-bold); }
.tcard__meta .sep { margin: 0 7px; color: var(--c-line, #d7dbe0); }
.tcard__note { margin: 8px 0 0; font-size: 12px; color: var(--c-pay); }
.tcard__record-note { margin: 8px 0 0; font-size: 12px; color: var(--c-text-sub); }

.tcard__actions { display: flex; gap: 8px; margin-top: 14px; }
.act { padding: 10px 14px; font-size: 13.5px; flex: 1; border-radius: var(--r-md, 12px); font-weight: var(--fw-bold); }
.act:disabled { cursor: not-allowed; opacity: .58; }
.ndetail { margin: 6px 0 0; }
.ndetail > div { display: flex; gap: 10px; font-size: 12px; line-height: 1.7; }
.ndetail dt { flex: 0 0 auto; width: 4.5em; margin: 0; color: var(--c-text-sub, #6b7280); }
.ndetail dd { margin: 0; min-width: 0; overflow-wrap: anywhere; font-weight: 700; }
.ndetail__why { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: var(--c-text-sub, #6b7280); }
.ndetail__why.is-block { color: var(--c-danger, #c2410c); }
.tbtn--disabled { opacity: 0.5; cursor: default; }
</style>
