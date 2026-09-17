import test from 'node:test'
import assert from 'node:assert/strict'
import { commitNotificationSettingsChange, foregroundPushTarget } from '../../src/lib/notificationSettingsCore.js'

test('通知設定の保存失敗時は画面に出す値を変更前へ戻す', async () => {
  const before = { pushEnabled: true, payments: true, chat: true, invites: true, events: false }
  const result = await commitNotificationSettingsChange(before, { payments: false }, async () => {
    throw new Error('offline')
  })
  assert.equal(result.saved, false)
  assert.deepEqual(result.settings, before)
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
