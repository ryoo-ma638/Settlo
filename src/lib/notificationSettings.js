import { app, db } from '../firebase'
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { normalizeNotificationSettings, foregroundPushTarget } from './notificationSettingsCore.js'
export { DEFAULT_NOTIFICATION_SETTINGS, normalizeNotificationSettings, commitNotificationSettingsChange, foregroundPushTarget } from './notificationSettingsCore.js'

export async function loadNotificationSettings(uid) {
  if (!uid) return normalizeNotificationSettings()
  const snap = await getDoc(doc(db, 'users', uid))
  return normalizeNotificationSettings(snap.exists() ? snap.data().notificationSettings : {})
}

export async function saveNotificationSettings(uid, settings) {
  if (!uid) throw new Error('ログイン状態を確認できません。')
  const normalized = normalizeNotificationSettings(settings)
  await setDoc(doc(db, 'users', uid), { notificationSettings: normalized }, { merge: true })
  return normalized
}

const messagingSupported = async () => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false
  return isSupported()
}

export async function getPushStatus() {
  if (!(await messagingSupported())) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'default'
}

async function registerCurrentDevice(uid) {
  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BJ1ETrFo6dkYa-TueyQTYuSYQbRi0BD_UJmh2bRigKzzZnhHjU7bsUZgLWrPWvngVsN9iwWTz6yZczxkn53-0_c' })
  if (!token) throw new Error('この端末を通知先として登録できませんでした。')
  await setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) }, { merge: true })
  return token
}

export async function enablePushForCurrentDevice(uid) {
  if (!(await messagingSupported())) return { status: 'unsupported' }
  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') return { status: permission }
  await registerCurrentDevice(uid)
  await listenForForegroundPush()
  return { status: 'granted' }
}

// 既に許可済みの場合だけトークンを更新する。ここでは許可画面を出さない。
export async function refreshPushRegistration(uid) {
  if (!uid || !(await messagingSupported()) || Notification.permission !== 'granted') return false
  await registerCurrentDevice(uid)
  return true
}

export async function unregisterPushForCurrentDevice(uid) {
  if (!uid || !(await messagingSupported()) || Notification.permission !== 'granted') return
  const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BJ1ETrFo6dkYa-TueyQTYuSYQbRi0BD_UJmh2bRigKzzZnhHjU7bsUZgLWrPWvngVsN9iwWTz6yZczxkn53-0_c' })
  if (token) await setDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }, { merge: true })
}

let foregroundUnsubscribe = null
export async function listenForForegroundPush() {
  if (foregroundUnsubscribe || !(await messagingSupported()) || Notification.permission !== 'granted') return
  const messaging = getMessaging(app)
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const title = payload.data?.title || payload.notification?.title || 'Settlo'
    const body = payload.data?.body || payload.notification?.body || '新しいお知らせがあります'
    try {
      const notice = new Notification(title, { body, icon: '/favicon.ico', tag: payload.data?.tag, data: { url: payload.data?.url || '/' } })
      notice.onclick = (event) => {
        event.preventDefault()
        window.focus()
        window.location.assign(foregroundPushTarget(notice.data?.url, window.location.href))
        notice.close()
      }
    } catch (e) {}
  })
}
