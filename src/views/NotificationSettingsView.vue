<template>
  <div class="settings">
    <PageHeader title="通知設定" fallback="/mypage" />
    <main class="settings__body">
      <section class="settings__card">
        <div class="settings__head">
          <div>
            <h2>端末へのプッシュ通知</h2>
            <p>{{ statusText }}</p>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="effectivePush" :disabled="controlsDisabled" @change="togglePush">
            <span aria-hidden="true"></span>
          </label>
        </div>
        <p v-if="pushStatus === 'denied'" class="settings__warning">ブラウザまたは端末の設定でSettloの通知を許可してください。</p>
        <p v-else-if="pushStatus === 'unsupported'" class="settings__warning">この環境では端末通知を利用できません。iPhone・iPadはSettloをホーム画面に追加して、アイコンから開いてください。</p>
      </section>

      <section class="settings__card" :class="{ 'is-disabled': !effectivePush }">
        <h2>通知する内容</h2>
        <SettingSwitch :modelValue="settings.payments" label="支払いと承認" description="支払い追加、承認、催促、削除や復元" :disabled="!effectivePush || controlsDisabled" @update:modelValue="updateCategory('payments', $event)" />
        <SettingSwitch :modelValue="settings.chat" label="チャット" description="新しいチャットメッセージ" :disabled="!effectivePush || controlsDisabled" @update:modelValue="updateCategory('chat', $event)" />
        <SettingSwitch :modelValue="settings.invites" label="招待とフレンド" description="イベントへの招待、参加申請、フレンド申請" :disabled="!effectivePush || controlsDisabled" @update:modelValue="updateCategory('invites', $event)" />
        <SettingSwitch :modelValue="settings.events" label="イベントの更新" description="イベントの編集などの情報" :disabled="!effectivePush || controlsDisabled" @update:modelValue="updateCategory('events', $event)" />
      </section>

      <button v-if="loadFailed" type="button" class="settings__retry" :disabled="busy" @click="loadSettings">通知設定を再読み込み</button>

      <section class="settings__note">
        <h2>アプリ内のお知らせ</h2>
        <p>支払いの承認など、対応が必要な記録は端末通知をオフにしてもアプリ内に残ります。支払いの金額や明細はロック画面に表示しません。</p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { auth } from '../firebase'
import PageHeader from '../components/PageHeader.vue'
import SettingSwitch from '../components/SettingSwitch.vue'
import { commitNotificationSettingsChange, getPushStatus, enablePushForCurrentDevice, loadNotificationSettings, saveNotificationSettings } from '../lib/notificationSettings'
import { showToast } from '../lib/toast'

const settings = reactive({ pushEnabled: true, payments: true, chat: true, invites: true, events: false })
const pushStatus = ref('default')
const busy = ref(true)
const loadFailed = ref(false)
const effectivePush = computed(() => settings.pushEnabled && pushStatus.value === 'granted')
const controlsDisabled = computed(() => busy.value || loadFailed.value)
const statusText = computed(() => ({
  granted: 'この端末で許可されています', denied: 'ブラウザまたは端末で拒否されています',
  unsupported: 'この環境では利用できません', default: 'まだこの端末で許可していません',
})[pushStatus.value])

const snapshotSettings = () => ({ ...settings })
const restoreSettings = (snapshot) => Object.assign(settings, snapshot)
const updateCategory = async (key, value) => {
  if (controlsDisabled.value) return
  const before = snapshotSettings()
  busy.value = true
  settings[key] = value
  await nextTick()
  const result = await commitNotificationSettingsChange(before, { [key]: value }, next => saveNotificationSettings(auth.currentUser?.uid, next))
  restoreSettings(result.settings)
  await nextTick()
  if (result.saved) {
    showToast('通知設定を保存しました')
  } else {
    showToast('通知設定を保存できませんでした。変更前の状態に戻しました')
  }
  busy.value = false
}
const togglePush = async (event) => {
  if (controlsDisabled.value) return
  const enabled = event.target.checked
  const before = snapshotSettings()
  busy.value = true
  try {
    let nextEnabled = enabled
    if (enabled) {
      const result = await enablePushForCurrentDevice(auth.currentUser?.uid)
      pushStatus.value = result.status
      nextEnabled = result.status === 'granted'
    }
    settings.pushEnabled = nextEnabled
    await nextTick()
    const saved = await commitNotificationSettingsChange(before, { pushEnabled: nextEnabled }, next => saveNotificationSettings(auth.currentUser?.uid, next))
    restoreSettings(saved.settings)
    await nextTick()
    showToast(saved.saved
      ? (settings.pushEnabled ? '端末通知をオンにしました' : '端末通知をオフにしました')
      : '端末通知の設定を保存できませんでした。変更前の状態に戻しました')
  } catch (e) {
    restoreSettings(before)
    await nextTick()
    showToast('端末通知の設定に失敗しました。変更前の状態に戻しました')
  } finally { busy.value = false }
}

const loadSettings = async () => {
  busy.value = true
  loadFailed.value = false
  try {
    const [saved, status] = await Promise.all([
      loadNotificationSettings(auth.currentUser?.uid),
      getPushStatus(),
    ])
    restoreSettings(saved)
    pushStatus.value = status
  } catch (e) {
    loadFailed.value = true
    showToast('通知設定を読み込めませんでした。再読み込みしてください')
  }
  finally { busy.value = false }
}

onMounted(loadSettings)
</script>

<style scoped>
.settings__body { padding: 12px var(--pad) 32px; display: grid; gap: 16px; }
.settings__card, .settings__note { background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--r-lg); padding: 18px; box-shadow: var(--shadow-sm); }
.settings__head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
h2 { font-size: 16px; font-weight: var(--fw-black); color: var(--c-ink); }
.settings__head p, .settings__note p { margin-top: 5px; font-size: 12.5px; line-height: 1.65; color: var(--c-text-sub); }
.settings__warning { margin-top: 14px; padding: 10px 12px; background: #fff7ed; border-radius: var(--r-md); color: #9a3412; font-size: 12.5px; line-height: 1.6; }
.settings__retry { min-height: 46px; border: 1px solid var(--c-line-bold); border-radius: var(--r-md); background: var(--c-surface); color: var(--c-text); font-weight: var(--fw-bold); }
.is-disabled { opacity: .62; }
.switch { flex: 0 0 auto; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch span { display: block; width: 48px; height: 28px; border-radius: 999px; background: var(--c-line-bold); padding: 3px; transition: .2s; }
.switch span::after { content: ''; display: block; width: 22px; height: 22px; border-radius: 50%; background: white; box-shadow: var(--shadow-sm); transition: .2s; }
.switch input:checked + span { background: var(--c-brand); }
.switch input:checked + span::after { transform: translateX(20px); }
.switch input:focus-visible + span { outline: 3px solid var(--c-brand-weak); outline-offset: 2px; }
</style>
