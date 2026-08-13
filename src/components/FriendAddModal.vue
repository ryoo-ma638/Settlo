<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="isOpen" class="modal-overlay" @click.self="close">
        <div class="add-modal">

          <div v-if="!selectedUser">
            <div class="add-modal__head">
              <span class="add-modal__badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M18 8v6M15 11h6" />
                </svg>
              </span>
              <h2 class="add-modal__title">フレンドを追加</h2>
              <p class="add-modal__sub">名前・ニックネーム・ID で探して申請できます</p>
            </div>

            <div class="seg">
              <button class="seg__item" :class="{ 'is-active': searchMode === 'name' }" @click="searchMode = 'name'">名前検索</button>
              <button class="seg__item" :class="{ 'is-active': searchMode === 'id' }" @click="searchMode = 'id'">ID検索</button>
            </div>

            <div class="search">
              <svg class="search__icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input v-model="searchQuery" type="text" :placeholder="searchMode === 'name' ? '名前を入力' : 'IDを入力'" class="search__input" />
            </div>

            <div class="results">
              <template v-if="searchQuery">
                <div v-for="user in searchResults" :key="user.uid" class="rescard">
                  <UserAvatar class="rescard__avatar" :name="user.name" :photo="user.photo" :size="36" />
                  <span class="rescard__name">
                    <span class="rescard__nm">{{ user.name }}
                      <span v-if="isEventMember(user.uid)" class="rescard__tag">同じイベント</span>
                      <span v-else-if="isAlreadyFriend(user.uid)" class="rescard__tag is-friend">フレンド済み</span>
                    </span>
                    <span v-if="user.nickname" class="rescard__nick">ニックネーム: {{ user.nickname }}</span>
                  </span>
                  <button v-if="!isAlreadyFriend(user.uid)" class="rescard__add" @click="selectedUser = user">追加</button>
                </div>
                <div v-if="searchResults.length === 0" class="empty-state">
                  <span class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                  </span>
                  <p class="empty-state__title">見つかりませんでした</p>
                  <p class="empty-state__desc">名前・ニックネーム・ID を確かめてみてください</p>
                </div>
              </template>
              <template v-else>
                <p v-if="eventMembers.length" class="cand-title">同じイベントのメンバー</p>
                <div v-for="user in eventMembers" :key="user.uid" class="rescard">
                  <UserAvatar class="rescard__avatar" :name="user.name" :photo="user.photo" :size="36" />
                  <span class="rescard__name">
                    <span class="rescard__nm">{{ user.name }}</span>
                    <span v-if="user.nickname" class="rescard__nick">ニックネーム: {{ user.nickname }}</span>
                  </span>
                  <button class="rescard__add" @click="selectedUser = user">追加</button>
                </div>
                <div v-if="eventMembers.length === 0" class="empty-state">
                  <span class="empty-state__icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M18 8v6M15 11h6" /></svg>
                  </span>
                  <p class="empty-state__title">名前か ID で検索</p>
                  <p class="empty-state__desc">相手のニックネームでも見つけられます</p>
                </div>
              </template>
            </div>

            <button class="modal-close" @click="close">閉じる</button>
          </div>

          <div v-else class="confirm">
            <h2 class="add-modal__title">フレンド追加</h2>

            <div class="confirm__user">
              <UserAvatar class="confirm__avatar" :name="selectedUser.name" :photo="selectedUser.photo" :size="84" />
              <h3 class="confirm__name">{{ selectedUser.name }}</h3>
            </div>

            <p class="confirm__q">このユーザーをフレンドに追加しますか？</p>

            <div class="confirm-history" v-if="tradeHistory.length > 0">
              <h4 class="ch-title">この人との取引履歴</h4>
              <ul class="ch-list">
                <li v-for="t in tradeHistory" :key="t.id">
                  <span class="ch-date">{{ t.date }}</span> {{ t.itemName }} <strong class="ch-price">¥{{ t.amount.toLocaleString() }}</strong>
                </li>
              </ul>
            </div>
            <p v-else-if="historyLoaded" class="confirm-no-history">この人との取引履歴はまだありません</p>

            <MessageField v-model="requestMessage" class="confirm__msg" placeholder="はじめまして。〇〇で一緒だった△△です。" />

            <div class="confirm__actions">
              <button class="btn-brand" @click="executeRequest">申請を送る</button>
              <button class="btn-outline" @click="selectedUser = null">検索に戻る</button>
            </div>
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
</template>

<script setup>
import { ref, watch, reactive } from 'vue';
import BaseModal from './BaseModal.vue'; // 🌟 統一モーダルをインポート
import MessageField from './MessageField.vue';
import UserAvatar from './UserAvatar.vue';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';

const props = defineProps({ isOpen: Boolean });
const emit = defineEmits(['close']);

const searchMode = ref('name');
const searchQuery = ref('');
const searchResults = ref([]);
const selectedUser = ref(null);
const requestMessage = ref(''); // 申請に添えるひとこと（任意）

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

// 検索処理
const performSearch = async () => {
  const text = searchQuery.value.trim();
  if (text.length === 0) { searchResults.value = []; return; }

  try {
    const results = [];

    if (searchMode.value === 'name') {
      // 🌟 名前・ニックネームの両方で先頭一致（前方一致）候補を出す
      const usersRef = collection(db, "users");
      const seen = new Set();
      const pushUser = (id, data) => {
        if (id === auth.currentUser?.uid || seen.has(id)) return;
        seen.add(id);
        results.push({ uid: id, name: data.name, nickname: data.nickname || "", photo: data.photo || "" });
      };
      const qName = query(usersRef, orderBy("name"), where("name", ">=", text), where("name", "<=", text + "\uf8ff"), limit(10));
      // ニックネームを設定している人だけがヒットする（例: 「大崎稜馬」が「稜馬」で見つかる）
      const qNick = query(usersRef, orderBy("nickname"), where("nickname", ">=", text), where("nickname", "<=", text + "\uf8ff"), limit(10));
      const [snapName, snapNick] = await Promise.all([getDocs(qName), getDocs(qNick)]);
      snapName.forEach((d) => pushUser(d.id, d.data()));
      snapNick.forEach((d) => pushUser(d.id, d.data()));
      // 🌟 同じイベントのメンバーは名前・ニックネームの「部分一致」でも候補に出す
      eventMembers.value.forEach(m => {
        if (!seen.has(m.uid) && ((m.name || '').includes(text) || (m.nickname || '').includes(text))) {
          seen.add(m.uid);
          results.push({ ...m });
        }
      });
    } else {
      const userDocRef = doc(db, "users", text);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.id !== auth.currentUser?.uid) {
        const data = userSnap.data();
        results.push({
          uid: userSnap.id,
          name: data.name,
          nickname: data.nickname || "",
          photo: data.photo || ""
        });
      }
    }

    searchResults.value = results;
  } catch (error) {
    console.error("検索エラー:", error);
  }
};

watch(searchQuery, () => performSearch());

// 🌟 同じイベントにいるメンバーを候補として読み込む（既にフレンドの人は除外）
const eventMembers = ref([]);
const friendUids = ref(new Set());
const isEventMember = (uid) => eventMembers.value.some(m => m.uid === uid);
const isAlreadyFriend = (uid) => friendUids.value.has(uid);
const loadCandidates = async () => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  try {
    const friendsSnap = await getDocs(collection(db, 'users', myUid, 'friends'));
    friendUids.value = new Set(friendsSnap.docs.map(d => d.id));
    const evs = await getDocs(query(collection(db, 'events'), where('participants', 'array-contains', myUid)));
    const uids = new Set();
    evs.forEach(e => (e.data().participants || []).forEach(u => { if (u !== myUid) uids.add(u); }));
    const arr = [];
    for (const u of uids) {
      if (friendUids.value.has(u)) continue; // 既にフレンドは候補から外す
      try {
        const ud = await getDoc(doc(db, 'users', u));
        if (ud.exists()) arr.push({ uid: u, name: ud.data().name || 'メンバー', nickname: ud.data().nickname || '', photo: ud.data().photo || ud.data().photoURL || '' });
      } catch (e) {}
    }
    eventMembers.value = arr;
  } catch (e) { console.error('候補の取得エラー:', e); }
};
watch(() => props.isOpen, (v) => { if (v) loadCandidates(); });

// 🌟 申請確認画面で「この人との本物の取引履歴」を表示
const tradeHistory = ref([]);
const historyLoaded = ref(false);
const loadHistory = async (targetUid) => {
  tradeHistory.value = [];
  historyLoaded.value = false;
  const myUid = auth.currentUser?.uid;
  if (myUid && targetUid) {
    try {
      const [s1, s2] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('paidById', '==', myUid))),
        getDocs(query(collection(db, 'transactions'), where('paidToId', '==', myUid))),
      ]);
      const results = [];
      const pushIf = (d) => {
        const x = d.data();
        if (x.paidById === targetUid || x.paidToId === targetUid) {
          results.push({
            id: d.id,
            itemName: x.itemName || '取引',
            amount: x.amount || 0,
            sec: x.createdAt?.seconds || 0,
            date: x.createdAt ? new Date(x.createdAt.seconds * 1000).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '',
          });
        }
      };
      s1.forEach(pushIf);
      s2.forEach(pushIf);
      const seen = new Set();
      tradeHistory.value = results
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .sort((a, b) => b.sec - a.sec);
    } catch (e) {
      console.error('取引履歴の取得エラー:', e);
    }
  }
  historyLoaded.value = true;
};
// 相手を選んだ（確認画面に進んだ）瞬間に履歴を取得
watch(selectedUser, (u) => {
  if (u) loadHistory(u.uid);
  else { tradeHistory.value = []; historyLoaded.value = false; }
});

const close = () => {
  searchQuery.value = '';
  selectedUser.value = null;
  requestMessage.value = '';
  emit('close');
};

// 🌟 申請を送る処理（alertをモーダルに変更）
const executeRequest = async () => {
  if (!auth.currentUser) {
    showModal({ type: 'error', title: 'エラー', message: 'ログインが必要です。' });
    return;
  }
  const targetUser = selectedUser.value;

  try {
    const myDocRef = doc(db, "users", auth.currentUser.uid);
    const myDoc = await getDoc(myDocRef);

    let myName = "名前なし";
    let myPhoto = "";

    if (myDoc.exists()) {
      const myData = myDoc.data();
      myName = myData.name || "名前なし";
      myPhoto = myData.photo || myData.photoURL || "";
    }

    await addDoc(collection(db, "friendRequests"), {
      toId: targetUser.uid,
      toName: targetUser.name,
      formId: auth.currentUser.uid,
      formName: myName,
      formPhoto: myPhoto,
      userMessage: requestMessage.value.trim() || null, // 申請に添えたひとこと（任意）
      status: "pending",
      createdAt: serverTimestamp()
    });

    showModal({
      type: 'success',
      title: '申請完了',
      message: `${targetUser.name}さんにフレンド申請を送りました！`,
      onConfirm: () => {
        emit('close');
      }
    });

  } catch (error) {
    console.error("エラー内容:", error);
    showModal({
      type: 'error',
      title: '送信失敗',
      message: '申請に失敗しました。もう一度試してください。'
    });
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background-color: var(--c-overlay);
  z-index: 2000;
  display: flex; justify-content: center; align-items: center;
  padding: 20px;
}
.add-modal {
  width: 100%;
  max-width: 360px;
  background: var(--c-surface);
  border-radius: var(--r-xl);
  padding: 22px;
  box-shadow: var(--shadow-pop);
}
.add-modal__head { text-align: center; margin-bottom: 18px; }
.add-modal__badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 16px;
  background: var(--c-brand-weak); color: var(--c-brand); margin-bottom: 10px;
}
.add-modal__badge svg { width: 26px; height: 26px; }
.add-modal__title {
  font-size: 19px; font-weight: var(--fw-bold); color: var(--c-ink); margin: 0 0 4px;
}
.add-modal__sub { font-size: 12px; font-weight: var(--fw-medium); color: var(--c-text-sub); margin: 0; }

.empty-state { text-align: center; padding: 30px 12px; }
.empty-state__icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--c-surface-2); color: var(--c-text-faint); margin-bottom: 12px;
}
.empty-state__icon svg { width: 26px; height: 26px; }
.empty-state__title { font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text); margin: 0 0 4px; }
.empty-state__desc { font-size: 12px; font-weight: var(--fw-medium); color: var(--c-text-faint); margin: 0; }

.seg { margin-bottom: 12px; }

/* 検索 */
.search {
  position: relative;
  margin-bottom: 14px;
}
.search__icon {
  position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
  width: 18px; height: 18px;
  fill: none; stroke: var(--c-text-faint); stroke-width: 1.9; stroke-linecap: round;
}
.search__input {
  width: 100%;
  padding: 12px 14px 12px 40px;
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-md);
  background: var(--c-surface);
  font-size: 15px;
}
.search__input:focus {
  outline: none; border-color: var(--c-brand);
  box-shadow: 0 0 0 3px var(--c-brand-weak);
}

/* 検索結果 */
.results {
  min-height: 120px;
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rescard {
  display: flex; align-items: center; gap: 11px;
  background: var(--c-surface-2);
  padding: 9px 12px;
  border-radius: var(--r-pill);
}
.rescard__name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rescard__nm { font-weight: var(--fw-bold); font-size: 14px; color: var(--c-ink); }
.rescard__nick { font-size: 11px; font-weight: var(--fw-medium); color: var(--c-text-sub); }
.rescard__add {
  background: var(--c-brand); color: #fff;
  padding: 6px 16px; border-radius: var(--r-pill);
  font-size: 13px; font-weight: var(--fw-bold);
}
.rescard__add:active { transform: scale(0.95); }

.empty-msg { text-align: center; color: var(--c-text-faint); font-size: 14px; padding: 28px 0; }
.cand-title { font-size: 11px; font-weight: 800; color: var(--c-text-faint); margin: 0 0 2px 4px; }
.rescard__tag { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; background: var(--c-brand-weak); color: var(--c-brand); font-size: 10px; font-weight: 800; vertical-align: middle; }
.rescard__tag.is-friend { background: var(--c-surface-2, var(--c-surface-2)); color: var(--c-text-sub); }

.modal-close {
  display: block;
  margin: 16px auto 0;
  padding: 11px 36px;
  background: var(--c-surface-2);
  color: var(--c-text-sub);
  border-radius: var(--r-pill);
  font-weight: var(--fw-bold);
  font-size: 14px;
}
.modal-close:active { transform: scale(0.97); }

/* 確認画面 */
.confirm { text-align: center; }
.confirm__user { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-bottom: 16px; }
.confirm__name { font-size: 20px; font-weight: var(--fw-bold); color: var(--c-ink); }
.confirm__q { font-size: 14px; font-weight: var(--fw-medium); color: var(--c-text-sub); margin-bottom: 16px; }

/* 取引履歴 */
.confirm-history { background: var(--c-surface-2, var(--c-surface-2)); border-radius: var(--r-md, 14px); padding: 14px 16px; margin-bottom: 18px; text-align: left; }
.ch-title { font-size: 11px; color: var(--c-text-faint, var(--c-text-faint)); font-weight: 800; margin: 0 0 10px; }
.ch-list { list-style: none; padding: 0; margin: 0; font-size: 14px; }
.ch-list li { display: flex; justify-content: space-between; align-items: center; gap: 8px; border-bottom: 1px dashed var(--c-line, var(--c-line-bold)); padding: 8px 0; }
.ch-list li:last-child { border-bottom: none; }
.ch-date { color: var(--c-text-faint, var(--c-text-faint)); font-size: 12px; }
.ch-price { color: var(--c-ink); }
.confirm-no-history { font-size: 12px; color: var(--c-text-faint, var(--c-text-faint)); font-weight: 700; margin: 0 0 18px; }

.confirm__msg { margin-bottom: 22px; }
.confirm__actions { display: flex; flex-direction: column; gap: 8px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
