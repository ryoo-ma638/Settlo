export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  pushEnabled: true,
  payments: true,
  chat: true,
  invites: true,
  events: false,
})

export const normalizeNotificationSettings = (value = {}) => ({
  ...DEFAULT_NOTIFICATION_SETTINGS,
  ...(value && typeof value === 'object' ? value : {}),
})

export async function commitNotificationSettingsChange(current, changes, persist) {
  const before = normalizeNotificationSettings(current)
  const next = normalizeNotificationSettings({ ...before, ...changes })
  try {
    return { saved: true, settings: normalizeNotificationSettings(await persist(next)) }
  } catch (error) {
    return { saved: false, settings: before, error }
  }
}

export function foregroundPushTarget(rawUrl, currentHref) {
  try {
    const current = new URL(currentHref)
    const target = new URL(rawUrl || '/', current)
    // 本番URLから届いた通知でも、画面位置だけを使って現在開いている環境内を移動する。
    if (target.hash.startsWith('#/')) return `${current.origin}${current.pathname}${current.search}${target.hash}`
    if (target.origin === current.origin) return target.href
  } catch (e) {}
  return currentHref
}
