<template>
  <div class="invcard">
    <div class="invcard__top">
      <span class="invcard__badge">招待を受けました</span>
      <span v-if="invite.createdAt" class="invcard__date">{{ formatDate(invite.createdAt) }}</span>
    </div>

    <p class="invcard__from">{{ invite.fromUserName || '相手' }}さんから招待</p>
    <h3 class="invcard__name">{{ invite.eventName || 'イベント' }}</h3>
    <p v-if="invite.userMessage" class="invcard__msg">{{ invite.userMessage }}</p>

    <div class="invcard__actions">
      <button class="invcard__btn invcard__btn--join" :disabled="busy" @click.stop="onAccept">
        {{ busy ? '処理中…' : '参加する' }}
      </button>
      <button class="invcard__btn invcard__btn--decline" :disabled="busy" @click.stop="askDecline">辞退</button>
    </div>

    <BaseModal
      :show="confirmShow"
      type="warning"
      title="この招待を辞退しますか？"
      :message="`イベント「${invite.eventName || ''}」への招待を辞退します。招待した人にお知らせが届きます。`"
      :showCancel="true"
      confirmText="辞退する"
      :withReason="true"
      reasonPlaceholder="辞退の理由を書けます（任意・相手に届きます）"
      @confirm="onDecline"
      @cancel="confirmShow = false"
      @close="confirmShow = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseModal from '@/components/BaseModal.vue';
import { formatDate } from '@/lib/format';
import { showToast } from '@/lib/toast';
import { acceptEventInvite, rejectEventInvite } from '@/lib/invite';

const props = defineProps({
  invite: { type: Object, required: true },
});
const emit = defineEmits(['handled']);

const router = useRouter();
const busy = ref(false); // 二重押しガード（参加通知や辞退通知が重複しないようにする）
const confirmShow = ref(false);

const onAccept = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    const res = await acceptEventInvite(props.invite);
    if (!res.ok) {
      showToast('参加できませんでした。時間をおいて試してください');
      return;
    }
    emit('handled', props.invite.id);
    showToast('イベントに参加しました');
    router.push(`/event/${res.eventId}`);
  } catch (e) {
    console.error('招待の参加に失敗:', e);
    showToast('参加に失敗しました。電波状況を確認してください');
  } finally {
    busy.value = false;
  }
};

const askDecline = () => {
  if (busy.value) return;
  confirmShow.value = true;
};

const onDecline = async (reason) => {
  confirmShow.value = false;
  if (busy.value) return;
  busy.value = true;
  try {
    await rejectEventInvite(props.invite, reason);
    emit('handled', props.invite.id);
    showToast('招待を辞退しました');
  } catch (e) {
    console.error('招待の辞退に失敗:', e);
    showToast('辞退に失敗しました。電波状況を確認してください');
  } finally {
    busy.value = false;
  }
};
</script>

<style scoped>
.invcard {
  background: var(--c-surface);
  border: 1.5px solid var(--c-brand-tint);
  border-radius: var(--r-lg);
  padding: 14px 16px;
  box-shadow: var(--shadow-card);
}
.invcard__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.invcard__badge {
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
  font-size: 11px;
  font-weight: var(--fw-bold);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}
.invcard__date { font-size: 12px; color: var(--c-text-faint); font-weight: var(--fw-medium); }
.invcard__from { font-size: 12px; color: var(--c-text-sub); font-weight: var(--fw-medium); }
.invcard__name {
  font-size: 16px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invcard__msg {
  margin-top: 8px;
  background: var(--c-surface-2);
  border-radius: var(--r-sm);
  padding: 8px 10px;
  font-size: 12.5px;
  color: var(--c-text);
  line-height: 1.5;
}
.invcard__actions { display: flex; gap: 8px; margin-top: 12px; }
.invcard__btn {
  flex: 1;
  padding: 10px 8px;
  border-radius: var(--r-pill);
  font-size: 13.5px;
  font-weight: var(--fw-bold);
  white-space: nowrap;
  transition: transform 0.12s ease, background-color 0.2s ease;
}
.invcard__btn:disabled { opacity: 0.5; }
.invcard__btn:active { transform: scale(0.98); }
.invcard__btn--join { background: var(--c-brand); color: #fff; }
.invcard__btn--decline {
  flex: 0 0 96px;
  background: var(--c-surface);
  border: 1.5px solid var(--c-line-bold);
  color: var(--c-text-sub);
}
</style>
