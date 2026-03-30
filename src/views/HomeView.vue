<template>
  <div class="home-container">
    <PaymentCarousel />

    <section class="ongoing-events">
      <div class="section-header">
        <h2 class="section-title">進行中のイベント</h2>
        <button class="view-all-btn" @click="$router.push('/event')">すべて見る ›</button>
      </div>

      <div class="event-list-container">
        <div v-if="ongoingEvents.length === 0" class="empty-message">
          進行中のイベントはありません
        </div>
        
        <div v-else class="event-item" v-for="event in ongoingEvents" :key="event.id" @click="openDetail(event)">
          <div class="event-tag">{{ event.tag }}</div>
          <div class="event-info">
            <h3 class="event-name">{{ event.name }}</h3>
            <div class="member-icons">
              <span class="circle c1"></span><span class="circle c2"></span><span class="circle c3"></span>
            </div>
          </div>
          <div class="event-amount-section">
            <span class="amount-label">合計金額</span>
            <span class="amount-value">{{ event.amount }}</span>
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
                <span class="modal-code">{{ selectedEvent.code }}</span>
                <button class="modal-copy-btn" @click="copyCode(selectedEvent.code)">コピー</button>
              </div>
            </div>

            <div class="modal-footer">
              <button class="go-detail-btn" @click="goToEventDetail(selectedEvent.id)">
                このイベントの詳細・精算へ進む
              </button>
              
              <button class="delete-btn" @click="deleteEvent(selectedEvent.id)">
                このイベントを終了する
              </button>
              
              <button class="cancel-btn" @click="selectedEvent = null">
                閉じる
              </button>
            </div>

          </div>
        </div>
      </transition>
    </Teleport>

    <button class="add-button" @click="$router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import PaymentCarousel from '@/components/PaymentCarousel.vue';
import api from '@/services/api'; // 🌟 連結用 api.ts をインポート

const router = useRouter();
const ongoingEvents = ref([]);
const selectedEvent = ref(null);
const loading = ref(true);

const openDetail = (event) => {
  selectedEvent.value = event;
};

const copyCode = (code) => {
  if (!code) return alert('コードがありません');
  navigator.clipboard.writeText(code);
  alert('コピーしました！');
};

// 🌟 イベント一覧をサーバーから取得する関数
const fetchEvents = async () => {
  try {
    loading.value = true;
    // 1. まずサーバー(Prisma)側にユーザー情報を同期する（連結の要）
    await api.post('/users/sync'); 
    
    // 2. サーバーからイベント一覧を取得
    const res = await api.get('/events');
    ongoingEvents.value = res.data;
  } catch (error) {
    console.error("イベント取得に失敗:", error);
  } finally {
    loading.value = false;
  }
};

const deleteEvent = async (id) => {
  if (!confirm('このイベントを終了して削除しますか？')) return;
  try {
    // 🌟 サーバー側のデータも消す（エンドポイントがある場合）
    // await api.delete(`/events/${id}`); 
    
    // フロントの表示を更新
    ongoingEvents.value = ongoingEvents.value.filter(e => e.id !== id);
    selectedEvent.value = null;
  } catch (error) {
    alert("削除に失敗しました");
  }
};

const goToEventDetail = (id) => {
  selectedEvent.value = null;
  router.push(`/event/${id}`);
};

onMounted(() => {
  // 🌟 2人のコメントを合体！起動時（ページ読み込み時）にサーバーと連結して同期・取得が走る
  fetchEvents(); 
});
</script>

<style scoped>
.home-container { position: relative; padding-bottom: 100px; background-color: #f8fafc; min-height: 100vh; }

/* 🌟 セクションヘッダー（タイトルとすべて見るボタン） */
.ongoing-events { padding: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.section-title { font-size: 18px; font-weight: bold; color: #1e293b; margin: 0; }
.view-all-btn { background: none; border: none; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer; }

/* 🌟 イベントリスト */
.event-list-container { display: flex; flex-direction: column; gap: 12px; }
.empty-message { text-align: center; color: #94a3b8; padding: 40px 0; font-size: 14px; font-weight: bold; background: white; border-radius: 16px; border: 2px dashed #e2e8f0; }
.event-item { background-color: white; border-radius: 16px; padding: 16px; display: flex; align-items: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s; }
.event-item:active { transform: scale(0.98); background-color: #f8fafc; }

.event-tag { background-color: #3b82f6; color: white; font-size: 11px; font-weight: bold; padding: 6px 12px; border-radius: 12px; margin-right: 15px; }
.event-info { flex: 1; }
.event-name { font-size: 16px; font-weight: bold; color: #1e293b; margin: 0 0 8px 0; }

.member-icons { display: flex; }
.circle { width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; margin-left: -8px; }
.circle:first-child { margin-left: 0; }
.c1 { background-color: #fca5a5; } .c2 { background-color: #93c5fd; } .c3 { background-color: #86efac; }

.event-amount-section { display: flex; flex-direction: column; align-items: flex-end; }
.amount-label { font-size: 10px; color: #64748b; font-weight: bold; }
.amount-value { font-size: 16px; font-weight: 900; color: #1e293b; }


/* 🌟 モーダルデザイン（画像に寄せてモダンに） */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 2000; padding: 20px; box-sizing: border-box; }
.detail-modal { background: white; width: 100%; max-width: 400px; border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-tag { background: #3b82f6; color: white; font-size: 12px; font-weight: bold; padding: 6px 16px; border-radius: 20px; }
.close-btn { background: none; border: none; font-size: 28px; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1; }

.modal-title { font-size: 24px; font-weight: 900; color: #1e293b; margin: 0 0 25px 0; }

.modal-section { margin-bottom: 25px; }
.modal-section label { display: block; font-size: 12px; color: #64748b; font-weight: bold; margin-bottom: 8px; }
.modal-text { background: #f8fafc; padding: 16px; border-radius: 12px; font-size: 14px; color: #334155; font-weight: bold; border: 1px solid #e2e8f0; }

.modal-code-box { display: flex; justify-content: space-between; align-items: center; background: #2a4c7a; padding: 16px 20px; border-radius: 16px; }
.modal-code { color: white; font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; }
.modal-copy-btn { background: white; color: #2a4c7a; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: 0.2s; }
.modal-copy-btn:active { transform: scale(0.95); }

/* 🌟 アクションボタン群 */
.modal-footer { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
.go-detail-btn { background: #10b981; color: white; border: none; padding: 16px; border-radius: 16px; font-size: 15px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(16,185,129,0.3); transition: 0.2s; }
.go-detail-btn:active { transform: scale(0.98); }

.delete-btn { background: white; border: 1.5px solid #ef4444; color: #ef4444; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.delete-btn:active { background: #fef2f2; }

.cancel-btn { background: #f1f5f9; color: #475569; border: none; padding: 14px; border-radius: 16px; font-size: 14px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.cancel-btn:active { background: #e2e8f0; }

/* その他 */
.add-button { position: fixed; right: 20px; bottom: 100px; width: 60px; height: 60px; background-color: #2169a3; color: white; border: none; border-radius: 50%; font-size: 36px; box-shadow: 0 4px 10px rgba(33,105,163,0.3); z-index: 100; cursor: pointer; }

/* アニメーション */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (min-width: 1024px) {
  .home-container { padding-bottom: 40px; }
  .add-button { display: none; }
}
</style>