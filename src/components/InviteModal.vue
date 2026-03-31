<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content slide-up">
        
        <div class="modal-header">
          <h3>友達をイベントに招待</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
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
              
              <div class="user-item" v-for="user in processedList" :key="user.id">
                <div class="user-left">
                  <div class="avatar" :style="{ backgroundColor: user.color }"></div>
                  <div class="user-info">
                    <span class="user-name">{{ user.name }}</span>
                    <span class="user-id">
                      ID: {{ user.userId }}
                      <span v-if="!user.isFriend" class="not-friend-badge">未フレンド</span>
                    </span>
                  </div>
                </div>
                <button 
                  class="invite-btn" 
                  :class="{ 'invited': invitedSet.has(user.id) }"
                  @click="invite(user.id)"
                  :disabled="invitedSet.has(user.id)"
                >
                  {{ invitedSet.has(user.id) ? '招待済み' : '招待する' }}
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
import { ref, computed, watch, reactive } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

const props = defineProps({
  isOpen: Boolean,
  eventCode: { type: String, default: 'EO2Q2Z' } 
});
const emit = defineEmits(['close']);

// 🌟 モーダル状態管理
const modalState = reactive({ show: false, type: 'info', title: '', message: '' });
const showModal = (options) => { Object.assign(modalState, { ...options, show: true }); };

const copyCode = () => {
  navigator.clipboard.writeText(props.eventCode);
  // 🌟 alert を美しいモーダルに
  showModal({ type: 'success', title: 'コピー完了', message: '招待コードをクリップボードにコピーしました！' });
};

const searchQuery = ref('');
const currentSort = ref('added_desc');
const invitedSet = ref(new Set()); 

const invite = (id) => {
  invitedSet.value.add(id);
};

const friendData = [
  { id: 1, userId: 'ryousuke123', name: '天野 椋祐', kana: 'アマノ リョウスケ', color: '#ff9980', isFriend: true, tradeCount: 5, addedAt: '2026-03-20' },
  { id: 2, userId: 'ryouhei_o', name: '小野木 涼平', kana: 'オノギ リョウヘイ', color: '#ffee10', isFriend: true, tradeCount: 12, addedAt: '2025-12-10' },
  { id: 4, userId: 'fuuka_n', name: '中橋 楓華', kana: 'ナカハシ フウカ', color: '#889900', isFriend: true, tradeCount: 8, addedAt: '2026-01-15' },
];

const globalData = [
  { id: 10, userId: 'sato_kenta', name: '佐藤 健太', kana: 'サトウ ケンタ', color: '#8bb4ff', isFriend: false, tradeCount: 0, addedAt: '' },
  { id: 11, userId: 'suzuki_h', name: '鈴木 花子', kana: 'スズキ ハナコ', color: '#f9a8d4', isFriend: false, tradeCount: 0, addedAt: '' }
];

const processedList = computed(() => {
  let list = [...friendData];
  const query = searchQuery.value.trim().toLowerCase();

  if (query) {
    const globalHits = globalData.filter(u => 
      u.name === query || u.userId.toLowerCase() === query || u.name.replace(/\s+/g, '') === query.replace(/\s+/g, '')
    );
    list = list.filter(u => 
      u.name.toLowerCase().includes(query) || 
      u.userId.toLowerCase().includes(query) ||
      u.kana.includes(query)
    );
    globalHits.forEach(gu => {
      if (!list.find(u => u.id === gu.id)) list.unshift(gu);
    });
  }

  return list.sort((a, b) => {
    if (currentSort.value === 'kana_asc') return a.kana.localeCompare(b.kana, 'ja');
    if (currentSort.value === 'trade_desc') return b.tradeCount - a.tradeCount;
    if (currentSort.value === 'added_desc') return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
    return 0;
  });
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    searchQuery.value = '';
    currentSort.value = 'added_desc';
  }
});
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
.code-section label { display: block; font-size: 13px; font-weight: bold; color: #64748b; margin-bottom: 8px; }
.code-box { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 12px 16px; border-radius: 12px; }
.code { color: white; font-family: monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; }
.copy-btn { background: white; color: #1e293b; border: none; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.copy-btn:active { transform: scale(0.95); }
.hint { font-size: 11px; color: #94a3b8; margin-top: 8px; margin-bottom: 0; }

.divider { border: none; border-top: 1px dashed #cbd5e1; margin: 0 0 20px 0; flex-shrink: 0; }

.invite-section { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.invite-section label { display: block; font-size: 13px; font-weight: bold; color: #64748b; margin-bottom: 10px; }

.search-box { margin-bottom: 10px; flex-shrink: 0; }
.search-input { width: 100%; padding: 12px 15px; border-radius: 12px; border: 1px solid #cbd5e1; background: white; font-size: 14px; font-weight: bold; color: #1e293b; outline: none; box-sizing: border-box; transition: 0.2s; }
.search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

.filter-controls { display: flex; justify-content: flex-end; margin-bottom: 15px; flex-shrink: 0; }
.custom-select { padding: 8px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; font-size: 12px; font-weight: bold; color: #64748b; outline: none; }

.user-list { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; padding-bottom: 10px; flex: 1; }
.user-item { display: flex; justify-content: space-between; align-items: center; background: white; border: 1px solid #f1f5f9; padding: 12px; border-radius: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
.user-left { display: flex; align-items: center; gap: 12px; }
.avatar { width: 36px; height: 36px; border-radius: 50%; }
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 15px; font-weight: bold; color: #1e293b; }
.user-id { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.not-friend-badge { background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: bold; }

.invite-btn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.invite-btn:active { transform: scale(0.95); }
.invite-btn.invited { background: #e2e8f0; color: #94a3b8; cursor: default; }
.invite-btn.invited:active { transform: none; }

.empty-msg { text-align: center; color: #94a3b8; font-size: 12px; font-weight: bold; padding: 30px 0; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>