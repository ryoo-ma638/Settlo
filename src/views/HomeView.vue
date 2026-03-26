<template>
  <div class="home-container">
    <section class="payment-status">
      <h2 class="section-title">お支払い状況</h2>
      <div class="status-card">
        <div class="status-box">
          <span class="badge blue">お支払い待ち</span>
          <div class="price blue-text">¥3,500</div>
          <div class="progress-bar"><div class="bar blue-bar"></div></div>
        </div>
        <div class="divider"></div>
        <div class="status-box">
          <span class="badge orange">未払い</span>
          <div class="price orange-text">¥4,800</div>
          <div class="progress-bar"><div class="bar orange-bar"></div></div>
        </div>
      </div>
    </section>

    <section class="ongoing-events">
      <h2 class="section-title">進行中のイベント</h2>
      <div class="event-list-container">
        <div v-if="ongoingEvents.length === 0" style="text-align:center; padding: 20px; color: #666;">
          進行中のイベントはありません
        </div>

        <div 
          class="event-item" 
          v-for="event in ongoingEvents" 
          :key="event.id"
        >
          <div class="event-tag" :class="{ gray: event.status !== 'active' }">
            {{ event.tag }}
          </div>
          <div class="event-info">
            <h3 class="event-name">{{ event.name }}</h3>
            <div class="member-icons">
              <span class="circle c1"></span><span class="circle c2"></span><span class="circle c3"></span>
            </div>
          </div>
          <div class="event-amount">{{ event.amount }}</div>
        </div>
      </div>
    </section>

    <button class="add-button" @click="router.push('/make-event')">+</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const ongoingEvents = ref([]);

// 画面が表示されるたびにデータを読み込む
onMounted(() => {
  const saved = localStorage.getItem('settlo_events');
  if (saved) {
    ongoingEvents.value = JSON.parse(saved);
  }
});
</script>

<style scoped>
/* スタイルは既存のものを維持 */
.home-container { position: relative; padding-bottom: 100px; }
.payment-status { padding: 20px; }
.section-title { font-size: 18px; margin-bottom: 15px; font-weight: bold; }
.status-card { display: flex; background-color: white; border-radius: 20px; padding: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); align-items: center; }
.status-box { text-align: center; flex: 1; }
.badge { display: inline-block; color: white; padding: 2px 12px; border-radius: 10px; font-size: 12px; margin-bottom: 8px; }
.blue { background-color: #3b82f6; }
.orange { background-color: #f59e0b; }
.price { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
.blue-text { color: #3b82f6; }
.orange-text { color: #f59e0b; }
.divider { width: 1px; height: 60px; background-color: #ccc; margin: 0 10px; }
.progress-bar { width: 80%; height: 6px; background-color: #eee; border-radius: 3px; margin: 0 auto; }
.blue-bar { width: 60%; background-color: #3b82f6; height: 100%; border-radius: 3px; }
.orange-bar { width: 40%; background-color: #f59e0b; height: 100%; border-radius: 3px; }
.ongoing-events { padding: 0 20px; }
.event-list-container { background-color: #dcdcdc; padding: 15px; border-radius: 10px; min-height: 100px; }
.event-item { background-color: white; border-radius: 15px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; }
.event-tag { background-color: #3b82f6; color: white; font-size: 10px; padding: 8px 4px; border-radius: 8px; width: 60px; text-align: center; margin-right: 12px; }
.event-tag.gray { background-color: #999; }
.event-info { flex: 1; }
.event-name { font-size: 16px; margin: 0 0 4px 0; }
.member-icons { display: flex; gap: 4px; }
.circle { width: 18px; height: 18px; border-radius: 50%; }
.c1 { background-color: #fca5a5; } .c2 { background-color: #93c5fd; } .c3 { background-color: #86efac; }
.event-amount { font-size: 13px; font-weight: bold; }
.add-button { position: fixed; right: 20px; bottom: 100px; width: 60px; height: 60px; background-color: #3b82f6; color: white; border: none; border-radius: 50%; font-size: 40px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer; z-index: 1000; }
</style>