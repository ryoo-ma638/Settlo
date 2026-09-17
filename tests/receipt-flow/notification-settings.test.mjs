import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import * as Vue from 'vue'
import { commitNotificationSettingsChange, foregroundPushTarget } from '../../src/lib/notificationSettingsCore.js'

function loadSettingsView({ save = async next => next } = {}) {
  const source = readFileSync(new URL('../../src/views/NotificationSettingsView.vue', import.meta.url), 'utf8')
  const content = compileScript(parse(source).descriptor, { id: 'notification-settings-test' }).content
  const script = content.replace(/^import .*;?\s*$/gm, '').replace('export default', 'return')
  const bindings = {
    computed: Vue.computed,
    nextTick: Vue.nextTick,
    onMounted: callback => queueMicrotask(callback),
    reactive: Vue.reactive,
    ref: Vue.ref,
    auth: { currentUser: { uid: 'u1' } },
    PageHeader: {},
    SettingSwitch: {},
    commitNotificationSettingsChange,
    getPushStatus: async () => 'granted',
    enablePushForCurrentDevice: async () => ({ status: 'granted' }),
    loadNotificationSettings: async () => ({ pushEnabled: true, payments: true, chat: true, invites: true, events: false }),
    saveNotificationSettings: (_, next) => save(next),
    showToast: () => {},
  }
  const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings))
  const scope = Vue.effectScope()
  const api = scope.run(() => component.setup({}, { expose: () => {} }))
  return { api, stop: () => scope.stop() }
}

test('通知設定の保存失敗時は画面に出す値を変更前へ戻す', async () => {
  const before = { pushEnabled: true, payments: true, chat: true, invites: true, events: false }
  const result = await commitNotificationSettingsChange(before, { payments: false }, async () => {
    throw new Error('offline')
  })
  assert.equal(result.saved, false)
  assert.deepEqual(result.settings, before)
})

test('実画面のスイッチも保存失敗時にOFF表示を残さずONへ戻す', async () => {
  const view = loadSettingsView({ save: async () => { throw new Error('offline') } })
  try {
    await new Promise(resolve => setImmediate(resolve))
    const transitions = []
    const stopWatch = Vue.watch(() => view.api.settings.pushEnabled, value => transitions.push(value), { flush: 'sync' })
    await view.api.togglePush({ target: { checked: false } })
    stopWatch()
    assert.deepEqual(transitions, [false, true])
    assert.equal(view.api.effectivePush.value, true)
  } finally { view.stop() }
})

test('通知設定の保存成功時だけ新しい値を返す', async () => {
  const before = { pushEnabled: true, payments: true, chat: true, invites: true, events: false }
  const result = await commitNotificationSettingsChange(before, { payments: false }, async next => next)
  assert.equal(result.saved, true)
  assert.equal(result.settings.payments, false)
})

test('前景通知の本番URLから現在開いているアプリ内の対象支払いへ移動する', () => {
  const target = foregroundPushTarget(
    'https://settlo-app.web.app/#/event/e1?history=h1',
    'http://localhost:5173/#/mypage',
  )
  assert.equal(target, 'http://localhost:5173/#/event/e1?history=h1')
  assert.equal(
    foregroundPushTarget('https://example.com/no-route', 'http://localhost:5173/#/mypage'),
    'http://localhost:5173/#/mypage',
  )
})
