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