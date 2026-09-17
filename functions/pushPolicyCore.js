const POLICIES = Object.freeze({
  payment_batch_added: { category: 'payments', body: data => `支払いが${Number(data.count) || 1}件追加されました。内容はアプリで確認してください。` },
  approval_request: { category: 'payments', body: () => '支払いの承認が必要です。' },
  approval_rejected: { category: 'payments', body: () => '支払いの確認結果があります。' },
  payment_reminder: { category: 'payments', body: () => '支払いの確認依頼があります。' },
  payment_completed: { category: 'payments', body: () => '支払いが完了しました。' },
  payment_edited: { category: 'payments', body: () => '支払いの内容が更新されました。' },
  payment_deleted: { category: 'payments', body: () => '支払いの削除について確認が必要です。' },
  payment_delete_rejected: { category: 'payments', body: () => '支払いの削除について確認が必要です。' },
  payment_reverted: { category: 'payments', body: () => '支払いが未精算に戻りました。' },
  settlement_restore_request: { category: 'payments', body: () => '精算状態の変更について承認が必要です。' },
  settlement_restore_approved: { category: 'payments', body: () => '精算状態が更新されました。' },
  settlement_restore_rejected: { category: 'payments', body: () => '精算状態の確認結果があります。' },
  restore_check: { category: 'payments', body: () => '復元された支払いの確認が必要です。' },
  restore_reverted: { category: 'payments', body: () => '支払いの復元結果があります。' },
  event_invite: { category: 'invites', body: () => 'イベントへの招待が届いています。' },
  invite_rejected: { category: 'invites', body: () => 'イベント招待の確認結果があります。' },
  event_join_request: { category: 'invites', body: () => 'イベントへの参加申請が届いています。' },
  event_join_approved: { category: 'invites', body: () => 'イベントへの参加が承認されました。' },
  event_join_rejected: { category: 'invites', body: () => 'イベントへの参加申請の結果があります。' },
  event_rejoin_request: { category: 'invites', body: () => 'イベントへの再参加申請が届いています。' },
  event_rejoin_approved: { category: 'invites', body: () => 'イベントへの再参加が承認されました。' },
  event_rejoin_rejected: { category: 'invites', body: () => 'イベントへの再参加申請の結果があります。' },
  event_edited: { category: 'events', body: () => 'イベントの内容が更新されました。' },
  event_restored: { category: 'invites', body: () => 'イベントの復元について確認が必要です。' },
  event_restore_rejected: { category: 'invites', body: () => 'イベントの復元結果があります。' },
  event_left_check: { category: 'invites', body: () => 'イベントからの退出について確認が必要です。' },
  event_left_rejected: { category: 'invites', body: () => 'イベントからの退出について確認結果があります。' },
  event_member_removed: { category: 'invites', body: () => 'イベントの参加状態が更新されました。' },
  friend_removed: { category: 'invites', body: () => 'フレンド状態について確認が必要です。' },
})

const defaults = Object.freeze({ pushEnabled: true, payments: true, chat: true, invites: true, events: false })

function policyForNotification(data) {
  if (!data || data.suppressPush === true) return { send: false }
  const policy = POLICIES[data.type]
  if (!policy) return { send: false }
  return { send: true, category: policy.category, body: policy.body(data) }
}

function settingsAllowPush(settings, category) {
  const value = settings && typeof settings === 'object' ? settings : {}
  if ((value.pushEnabled ?? defaults.pushEnabled) !== true) return false
  return (value[category] ?? defaults[category]) === true
}

function shouldRefreshPaymentBatchPush(before, after) {
  if (!before || !after || before.type !== 'payment_batch_added' || after.type !== 'payment_batch_added') return false
  if (!after.toUserId || before.toUserId !== after.toUserId) return false
  if (!after.operationId || before.operationId !== after.operationId) return false
  return Number(after.count) > Number(before.count)
}

module.exports = { policyForNotification, settingsAllowPush, shouldRefreshPaymentBatchPush, POLICIES }
