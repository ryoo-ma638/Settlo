<template>
  <div class="home">
    <PaymentCarousel :summary="paymentSummary" />

    <section class="ongoing">
      <div class="ongoing__head">
        <h2 class="section-title">進行中のイベント</h2>
        <button class="ongoing__all" @click="$router.push('/event')">すべて見る</button>
      </div>

      <div class="ongoing__list">
        <div v-if="loading" class="ongoing__empty">読み込み中…</div>

        <div v-else-if="ongoingEvents.length === 0" class="ongoing__empty">
          進行中のイベントはありません
        </div>

        <div v-else class="ev" v-for="event in ongoingEvents" :key="event.id" @click="goToEventDetail(event.id)">
          <span class="ev__tag">{{ event.tag }}</span>
          <div class="ev__info">
            <h3 class="ev__name">{{ event.name }}</h3>
            <div class="ev__members">
              <template v-for="(photo, index) in (event.participantsPhotos || []).slice(0, 4)" :key="index">
                <img v-if="photo.startsWith('http')" :src="photo" class="ev__circle" :style="{ zIndex: 5 - index }" />
                <div v-else class="ev__circle" :style="{ backgroundColor: photo, zIndex: 5 - index }"></div>
              </template>
              <div v-if="(event.participants || []).length > 4" class="ev__more">
                +{{ (event.participants || []).length - 4 }}
              </div>
            </div>
          </div>
          <div class="ev__amount">
            <span class="ev__amount-label">合計金額</span>
            <span class="ev__amount-value tnum">{{ event.amount }}</span>
          </div>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="selectedEvent" class="modal-overlay" @click.self="selectedEvent = null">
          <div class="detail-modal">
            <div class="modal-header">
              <span class="modal-tag">{{ selectedEvent.tag }}</span>
              <button class="close-btn" @click="selectedEvent = null">×</button>
            </div>

            <h2 class="modal-title">{{ selectedEvent.name }}</h2>

            <div class="modal-section">
              <label>メモ（目的・ルール）</label>
              <div class="modal-text">{{ selectedEvent.memo || 'メモはありません' }}</div>
            </div>

            <div class="modal-section">
              <label>招待コード</label>
              <div class="modal-code-box">
                <span class="modal-code">{{ selectedEvent.invitationCode }}</span>
                <button class="modal-copy-btn" @click="copyCode(selectedEvent.invitationCode)">コピー</button>
              </div>
            </div>

            <div class="modal-footer">
              <button class="go-detail-btn" @click="goToEventDetail(selectedEvent.id)">
                このイベントの詳細・精算へ進む
              </button>
              <button class="delete-btn" @click="deleteEvent(selectedEvent.id)">
                このイベントを削除する
              </button>
              <button class="cancel-btn" @click="selectedEvent = null">閉じる</button>
            </div>
          </div>
        </div>
      </transition>

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
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { db, auth } from '@/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, deleteDoc, updateDoc, addDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import PaymentCarousel from '@/components/PaymentCarousel.vue';
import BaseModal from '@/components/BaseModal.vue'; // 🌟 Eventブランチの統一モーダル
import api from '@/services/api';

const router = useRouter();
const ongoingEvents = ref([]);
const selectedEvent = ref(null);
const loading = ref(true);

const openDetail = (event) => {
  selectedEvent.value = event;
};

// 🌟 モーダル状態管理 (Eventブランチの機能)
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

const paymentSummary = ref({
  receivableTotal: 0,
  receivableList: [],
  payableTotal: 0,
  payableList: []
});

// ==========================================
// 🌟 1. 名前とアイコン取得の効率化（mainブランチの機能）
// ==========================================
const userCache = {};

const getUserInfo = async (uid) => {
  if (!uid) return { name: "不明", icon: "#cbd5e1" };
  if (userCache[uid]) return userCache[uid];

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const userInfo = {
        name: data.name || "不明",
        icon: data.photoURL || data.photo || data.color || "#cbd5e1"
      };
      userCache[uid] = userInfo;
      return userInfo;
    }
    return { name: "不明", icon: "#cbd5e1" };
  } catch (error) {
    console.error("User info fetch error:", error);
    return { name: "不明", icon: "#cbd5e1" };
  }
};

const getUserName = async (uid) => {
  const info = await getUserInfo(uid);
  return info.name;
};

// ==========================================
// 🌟 2. イベント一覧をサーバーから取得・整形する関数（mainブランチの機能）
// ==========================================
const fetchEvents = async () => {
  try {
    loading.value = true;
    const myUid = auth.currentUser?.uid;
    if (!myUid) return;

    // APIを使わず、直接Firestoreから自分のイベントを取得
    const eventsRef = collection(db, "events");
    const q = query(eventsRef, where("participants", "array-contains", myUid));
    const snapshot = await getDocs(q);

    const rawEvents = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(event => !(event.hiddenBy || []).includes(myUid)); // 自分がゴミ箱に入れたイベントは非表示

    const formattedEvents = await Promise.all(rawEvents.map(async (event) => {
      const uids = event.participants || [];
      const photos = await Promise.all(
        uids.slice(0, 4).map(async (uid) => {
          const info = await getUserInfo(uid);
          return info.icon;
        })
      );

      return {
        ...event,
        invitationCode: event.invitationCode || 'N/A',
        amount: `¥${(event.totalAmount || 0).toLocaleString()}`,
        participantsPhotos: photos
      };
    }));

    ongoingEvents.value = formattedEvents;

  } catch (error) {
    console.error("イベント取得に失敗:", error);
  } finally {
    loading.value = false;
  }
};

// --- 取引情報の監視ロジック ---
let unsubReceivable = null;
let unsubPayable = null;

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const myUid = user.uid;

      // 入金待ち
      const qReceivable = query(collection(db, "transactions"), where("paidToId", "==", myUid));
      unsubReceivable = onSnapshot(qReceivable, async (snapshot) => {
        let total = 0;
        const docs = snapshot.docs.filter(d => (d.data().status || 'unpaid') !== 'completed');
        const list = await Promise.all(docs.map(async (d) => {
          const data = d.data();
          total += data.amount || 0;
          const name = await getUserName(data.paidById);
          return { id: d.id, name, itemName: data.itemName, amount: data.amount, status: data.status || 'unpaid' };
        }));
        paymentSummary.value.receivableTotal = total;
        paymentSummary.value.receivableList = list;
      });

      // 未払い
      const qPayable = query(collection(db, "transactions"), where("paidById", "==", myUid));
      unsubPayable = onSnapshot(qPayable, async (snapshot) => {
        let total = 0;
        const docs = snapshot.docs.filter(d => (d.data().status || 'unpaid') !== 'completed');
        const list = await Promise.all(docs.map(async (d) => {
          const data = d.data();
          total += data.amount || 0;
          const name = await getUserName(data.paidToId);
          return { id: d.id, name: name, itemName: data.itemName, amount: data.amount, status: data.status || 'unpaid' };
        }));
        paymentSummary.value.payableTotal = total;
        paymentSummary.value.payableList = list;
      });
    }
  });

  fetchEvents();
});

onUnmounted(() => {
  if (unsubReceivable) unsubReceivable();
  if (unsubPayable) unsubPayable();
});

// 🌟 コピー完了の alert を美しいモーダルに！ (Eventブランチの機能)
const copyCode = (code) => {
  if (!code) {
    showModal({ type: 'error', title: 'エラー', message: 'コードがありません' });
    return;
  }
  navigator.clipboard.writeText(code)
    .then(() => {
      showModal({ type: 'success', title: 'コピー完了', message: '招待コードをコピーしました！LINE等でシェアしましょう。' });
    })
    .catch(() => {
      showModal({ type: 'error', title: 'エラー', message: 'コピーに失敗しました' });
    });
};

// 🌟 イベントの削除＝イベント詳細と同じソフト削除（自分の画面から非表示＋ゴミ箱＋相手へ確認通知）
//    ※以前ここにあった「全員分を完全削除する」旧処理は危険なため廃止
const deleteEvent = async (id) => {
  const ev = ongoingEvents.value.find(e => e.id === id) || selectedEvent.value || {};
  selectedEvent.value = null; // 先にポップアップを閉じて、確認を1つだけにする
  showModal({
    type: 'warning',
    title: 'イベントを削除しますか？',
    message: 'このイベントを自分の画面から削除します。ゴミ箱に入り、7日以内なら復元できます（相手の画面には残ります）。',
    showCancel: true,
    confirmText: '削除する',
    onConfirm: async () => {
      try {
        const myUid = auth.currentUser?.uid;
        if (!myUid) return;
        // 自分の画面からだけ非表示にする
        await updateDoc(doc(db, "events", id), { hiddenBy: arrayUnion(myUid) });
        // ゴミ箱に控えを残す（7日以内なら復元可）
        const evTrashRef = await addDoc(collection(db, "users", myUid, "trash"), {
          type: 'event',
          eventId: id,
          eventName: ev.name || 'イベント',
          eventTag: ev.tag || 'その他',
          trashedAt: serverTimestamp(),
          status: 'trashed',
        });
        // 他の参加者へ「抜けました。正しいですか？」を届ける
        const evDoc = await getDoc(doc(db, "events", id));
        const parts = evDoc.exists() ? (evDoc.data().participants || []) : [];
        for (const uid of parts) {
          if (uid === myUid) continue;
          try {
            await addDoc(collection(db, "notifications"), {
              toUserId: uid, type: 'event_left_check',
              eventId: id, eventName: ev.name || 'イベント',
              trashId: evTrashRef.id,
              fromUserId: myUid, fromUserName: auth.currentUser?.displayName || 'メンバー',
              isRead: false, createdAt: serverTimestamp(),
            });
          } catch (e) {}
        }
        ongoingEvents.value = ongoingEvents.value.filter(e => e.id !== id);
      } catch (error) {
        console.error("イベント削除エラー:", error);
        showModal({ type: 'error', title: 'エラー', message: '削除に失敗しました' });
      }
    }
  });
};

const goToEventDetail = (id) => {
  selectedEvent.value = null;
  router.push(`/event/${id}`);
};
</script>

<style scoped>
.home {
  padding: 4px 16px 28px;
}

.ongoing { padding-top: 14px; }
.ongoing__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}
.section-title { font-size: 17px; font-weight: var(--fw-bold); color: var(--c-ink); }
.ongoing__all { color: var(--c-brand); font-size: 13px; font-weight: var(--fw-bold); }

.ongoing__list { display: flex; flex-direction: column; gap: 12px; }

.ongoing__empty {
  text-align: center;
  color: var(--c-text-faint);
  padding: 36px 0;
  font-size: 14px;
  font-weight: var(--fw-medium);
  background: var(--c-surface);
  border-radius: var(--r-lg);
  border: 1px dashed var(--c-line-bold);
}

/* イベントカード */
.ev {
  background: var(--c-surface);
  border-radius: var(--r-lg);
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.ev:active { transform: scale(0.985); }

.ev__tag {
  flex-shrink: 0;
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
  font-size: 11px;
  font-weight: var(--fw-bold);
  padding: 5px 11px;
  border-radius: var(--r-pill);
}
.ev__info { flex: 1; min-width: 0; }
.ev__name {
  font-size: 16px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ev__members { display: flex; align-items: center; }
.ev__circle {
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid var(--c-surface); margin-left: -9px; object-fit: cover;
  background: var(--c-line-bold);
}
.ev__circle:first-child { margin-left: 0; }
.ev__more {
  width: 26px; height: 26px; border-radius: 50%;
  border: 2px solid var(--c-surface); margin-left: -9px;
  background: var(--c-surface-2); color: var(--c-text-sub);
  font-size: 10px; font-weight: var(--fw-bold);
  display: flex; align-items: center; justify-content: center;
}
.ev__amount { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.ev__amount-label { font-size: 10px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.ev__amount-value { font-size: 17px; font-weight: var(--fw-black); color: var(--c-ink); }

/* 詳細モーダル */
.modal-overlay {
  position: fixed; inset: 0;
  background: var(--c-overlay);
  display: flex; justify-content: center; align-items: center;
  z-index: 2000; padding: 20px;
}
.detail-modal {
  background: var(--c-surface);
  width: 100%; max-width: 400px;
  border-radius: var(--r-xl);
  padding: 26px;
  box-shadow: var(--shadow-pop);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.modal-tag {
  background: var(--c-brand-weak); color: var(--c-brand-strong);
  font-size: 12px; font-weight: var(--fw-bold); padding: 6px 14px; border-radius: var(--r-pill);
}
.close-btn { font-size: 26px; color: var(--c-text-faint); line-height: 1; }
.modal-title { font-size: 22px; font-weight: var(--fw-black); color: var(--c-ink); margin-bottom: 22px; }
.modal-section { margin-bottom: 20px; }
.modal-section label { display: block; font-size: 12px; color: var(--c-text-sub); font-weight: var(--fw-bold); margin-bottom: 8px; }
.modal-text {
  background: var(--c-surface-2); padding: 14px; border-radius: var(--r-md);
  font-size: 14px; color: var(--c-text); border: 1px solid var(--c-line);
}
.modal-code-box {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--c-brand-deep); padding: 14px 18px; border-radius: var(--r-md);
}
.modal-code { color: #fff; font-size: 26px; font-weight: var(--fw-bold); letter-spacing: 5px; }
.modal-copy-btn { background: #fff; color: var(--c-brand-deep); padding: 8px 16px; border-radius: var(--r-sm); font-size: 12px; font-weight: var(--fw-bold); }
.modal-copy-btn:active { transform: scale(0.96); }
.modal-footer { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
.go-detail-btn { background: var(--c-brand); color: #fff; padding: 15px; border-radius: var(--r-md); font-size: 15px; font-weight: var(--fw-bold); }
.go-detail-btn:active { transform: scale(0.98); background: var(--c-brand-strong); }
.delete-btn { background: #fff; border: 1.5px solid var(--c-danger); color: var(--c-danger); padding: 13px; border-radius: var(--r-md); font-size: 14px; font-weight: var(--fw-bold); }
.delete-btn:active { background: var(--c-danger-weak); }
.cancel-btn { background: var(--c-surface-2); color: var(--c-text-sub); padding: 13px; border-radius: var(--r-md); font-size: 14px; font-weight: var(--fw-bold); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
