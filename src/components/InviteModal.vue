<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h3>友達をイベントに招待</h3>
          <button class="close-btn" @click="$emit('close')" aria-label="閉じる">×</button>
        </div>

        <div class="modal-body">
          <div class="code-section">
            <label>招待コード</label>
            <div class="code-box">
              <span class="code">{{ eventCode }}</span>
              <button class="copy-btn" @click="copyCode">コピー</button>
            </div>
            <p class="hint">このコードをシェアして参加してもらいましょう！</p>
          </div>

          <hr class="divider" />

          <div class="invite-section">
            <label>フレンドから招待</label>
            
            <div class="search-box">
              <input v-model="searchQuery" type="text" placeholder="名前 または ID で検索" class="search-input" />
            </div>

            <div class="filter-controls">
              <select v-model="currentSort" class="custom-select">
                <option value="added_desc">追加順</option>
                <option value="kana_asc">あいうえお順</option>
                <option value="trade_desc">取引多い順</option>
              </select>
            </div>

            <div class="user-list">
              <div v-if="processedList.length === 0" class="empty-msg">該当するユーザーがいません</div>
              
              <div class="user-item" v-for="user in processedList" :key="user.uid">
                <div class="user-left">
                  <img v-if="user.photo" :src="user.photo" class="avatar-img" />
                  <div v-else class="avatar" :style="{ backgroundColor: user.color }"></div>
                  <div class="user-info">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-id">
                      <span v-if="user.isFriend" class="friend-badge">フレンド</span>
                      <span v-else class="not-friend-badge">未フレンド</span>
                    </span>
                  </div>
                </div>
                <button
                  class="invite-btn"
                  :class="{ 'invited': isParticipant(user.uid) || invitedSet.has(user.uid) }"
                  @click="invite(user)"
                  :disabled="isParticipant(user.uid) || invitedSet.has(user.uid)"
                >
                  {{ isParticipant(user.uid) ? '参加済み' : (invitedSet.has(user.uid) ? '招待済み' : '招待する') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <BaseModal 
      :show="modalState.show"
      :type="modalState.type"
      :title="modalState.title"
      :message="modalState.message"
      @confirm="modalState.show = false"
      @close="modalState.show = false"
    />
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, reactive, onUnmounted } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where, limit, addDoc, serverTimestamp } from 'firebase/firestore';

const props = defineProps({
  isOpen: Boolean,
  eventCode: { type: String, default: '------' },
  // 🌟 実データ化：招待先イベントのIDと、現在の参加者UID一覧を受け取る
  eventId: { type: String, default: '' },
  eventName: { type: String, default: '' },
  myName: { type: String, default: '' },
  participantUids: { type: Array, default: () => [] },
});
const emit = defineEmits(['close']);

// 🌟 モーダル状態管理
const modalState = reactive({ show: false, type: 'info', title: '', message: '' });
const showModal = (options) => { Object.assign(modalState, { ...options, show: true }); };

const copyCode = () => {
  navigator.clipboard.writeText(props.eventCode);
  showModal({ type: 'success', title: 'コピー完了', message: '招待コードをクリップボードにコピーしました！' });
};

const searchQuery = ref('');
const currentSort = ref('added_desc');
const invitedSet = ref(new Set());

// 🌟 自分の本物のフレンド一覧（users/{myUid}/friends をリアルタイム購読）
const friends = ref([]);
let unsubFriends = null;
const startFriends = () => {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  if (unsubFriends) unsubFriends();
  unsubFriends = onSnapshot(collection(db, 'users', myUid, 'friends'), (snap) => {
    friends.value = snap.docs.map((d) => {
      const x = d.data();
      return {
        uid: x.uid || d.id,
        name: x.name || '名前なし',
        photo: x.photo || x.photoURL || '',
        color: x.color || '#cbd5e1',
        kana: x.kana || '',
        isFriend: x.isFriend !== false,
        tradeCount: x.tradeCount || 0,
        addedSec: x.addedAt?.seconds || 0,
      };
    });
  });
};

// 🌟 フレンド以外も招待できるように、名前(完全一致)・UIDで全ユーザー検索
const globalResults = ref([]);
const runGlobalSearch = async () => {
  const text = searchQuery.value.trim();
  globalResults.value = [];
  if (!text) return;
  const myUid = auth.currentUser?.uid;
  const found = [];
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('name', '==', text), limit(10)));
    snap.forEach((d) => {
      if (d.id !== myUid) {
        const x = d.data();
        found.push({ uid: d.id, name: x.name || '名前なし', photo: x.photo || x.photoURL || '', color: '#cbd5e1', kana: x.kana || '', isFriend: false, tradeCount: 0, addedSec: 0 });
      }
    });
    // 名前で見つからなければ、UID直接指定でも引けるように
    if (found.length === 0) {
      const ds = await getDoc(doc(db, 'users', text));
      if (ds.exists() && ds.id !== myUid) {
        const x = ds.data();
        found.push({ uid: ds.id, name: x.name || '名前なし', photo: x.photo || x.photoURL || '', color: '#cbd5e1', kana: '', isFriend: false, tradeCount: 0, addedSec: 0 });
      }
    }
  } catch (e) {
    console.error('ユーザー検索エラー:', e);
  }
  // すでにフレンドの人は（下のフレンド一覧に出るので）重複除去
  const friendUids = new Set(friends.value.map((f) => f.uid));
  globalResults.value = found.filter((u) => !friendUids.has(u.uid));
};
watch(searchQuery, () => runGlobalSearch());

const processedList = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = friends.value.slice();
  if (q) {
    list = list.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.kana || '').includes(searchQuery.value.trim()) ||
      u.uid.toLowerCase() === q
    );
  }
  // 非フレンドの検索ヒットを先頭に差し込み、UID重複を除去
  const merged = [...globalResults.value, ...list];
  const seen = new Set();
  const uniq = [];
  for (const u of merged) {
    if (!seen.has(u.uid)) { seen.add(u.uid); uniq.push(u); }
  }
  return uniq.sort((a, b) => {
    if (currentSort.value === 'kana_asc') return (a.kana || '').localeCompare(b.kana || '', 'ja');
    if (currentSort.value === 'trade_desc') return b.tradeCount - a.tradeCount;
    return b.addedSec - a.addedSec;
  });
});

const isParticipant = (uid) => (props.participantUids || []).includes(uid);

// 🌟 承認制：即追加せず「招待通知」を送る（相手が承認するとイベントに参加）
const invite = async (user) => {
  if (!props.eventId) {
    showModal({ type: 'error', title: 'エラー', message: 'イベント情報が取得できませんでした。' });
    return;
  }
  if (isParticipant(user.uid)) {
    showModal({ type: 'info', title: '参加済み', message: `${user.name}さんはすでにこのイベントに参加しています。` });
    return;
  }
  try {
    await addDoc(collection(db, 'notifications'), {
      toUserId: user.uid,
      type: 'event_invite',
      eventId: props.eventId,
      eventName: props.eventName || '',
      fromUserId: auth.currentUser?.uid || 'unknown',
      fromUserName: props.myName || auth.currentUser?.displayName || 'メンバー',
      isRead: false,
      createdAt: serverTimestamp(),
    });
    invitedSet.value.add(user.uid);
    showModal({ type: 'success', title: '招待を送りました', message: `${user.name}さんに招待を送りました。相手が承認するとイベントに参加します。` });
  } catch (e) {
    console.error('招待エラー:', e);
    showModal({ type: 'error', title: '招待失敗', message: '招待に失敗しました。電波状況を確認してください。' });
  }
};

watch(() => props.isOpen, (open) => {
  if (open) {
    searchQuery.value = '';
    currentSort.value = 'added_desc';
    invitedSet.value = new Set();
    globalResults.value = [];
    startFriends();
  } else if (unsubFriends) {
    unsubFriends();
    unsubFriends = null;
  }
});

onUnmounted(() => { if (unsubFriends) unsubFriends(); });
</script>

<style scoped>
/* 既存スタイルそのまま */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; }
.modal-content { background: #f8fafc; width: 100%; max-width: 600px; border-radius: 30px 30px 0 0; padding: 25px 25px 40px; box-sizing: border-box; max-height: 85vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0; }
.modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: bold; }
.close-btn { background: none; border: none; font-size: 28px; color: #94a3b8; cursor: pointer; line-height: 1; }

.modal-body { display: flex; flex-direction: column; flex: 1; min-height: 0; }

.code-section { margin-bottom: 20px; flex-shrink: 0; }
.code-section label { display: block; font-size: 13px; font-weight: bold; color: var(--c-text-sub); margin-bottom: 8px; }
.code-box { display: flex; justify-content: space-between; align-items: center; background: var(--c-brand-deep); padding: 12px 16px; border-radius: 12px; }
.code { color: white; font-size: 24px; font-weight: bold; letter-spacing: 4px; }
.copy-btn { background: white; color: var(--c-brand-deep); border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.copy-btn:active { transform: scale(0.95); }
.hint { font-size: 11px; color: #94a3b8; margin-top: 8px; margin-bottom: 0; }

.divider { border: none; border-top: 1px dashed #cbd5e1; margin: 0 0 20px 0; flex-shrink: 0; }

.invite-section { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.invite-section label { display: block; font-size: 13px; font-weight: bold; color: var(--c-text-sub); margin-bottom: 10px; }

.search-box { margin-bottom: 10px; flex-shrink: 0; }
.search-input { width: 100%; padding: 12px 15px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; font-size: 14px; font-weight: bold; color: #1e293b; outline: none; box-sizing: border-box; transition: 0.2s; }
.search-input:focus { border-color: var(--c-brand); box-shadow: 0 0 0 3px var(--c-brand-weak); }

.filter-controls { display: flex; justify-content: flex-end; margin-bottom: 15px; flex-shrink: 0; }
.custom-select { padding: 8px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; font-size: 12px; font-weight: bold; color: var(--c-text-sub); outline: none; }

.user-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; padding-bottom: 10px; flex: 1; }
.user-item { display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #f1f5f9; padding: 12px; border-radius: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
.user-left { display: flex; align-items: center; gap: 12px; }
.avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; box-sizing: border-box; aspect-ratio: 1 / 1; }
.avatar-img { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-sizing: border-box; aspect-ratio: 1 / 1; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 15px; font-weight: bold; color: #1e293b; }
.user-id { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.not-friend-badge { background: #fee2e2; color: var(--c-danger); padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: bold; }
.friend-badge { background: var(--c-brand-weak); color: var(--c-brand-strong); padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: bold; }

.invite-btn { background: var(--c-brand); color: white; border: none; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.invite-btn:active { transform: scale(0.95); }
.invite-btn.invited { background: #e2e8f0; color: #94a3b8; cursor: default; }
.invite-btn.invited:active { transform: none; }

.empty-msg { text-align: center; color: #94a3b8; font-size: 12px; font-weight: bold; padding: 30px 0; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>