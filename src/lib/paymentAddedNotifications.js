import { app } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const MAX_RECEIPTS = 5;
const CALL_TIMEOUT_MS = 15000;

let injectedCaller = null;

export function setPaymentNotificationCaller(caller) {
  injectedCaller = typeof caller === 'function' ? caller : null;
}

function validId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('/');
}

export async function publishPaymentAddedNotifications({ eventId, historyIds, timeoutMs = CALL_TIMEOUT_MS } = {}) {
  const ids = [...new Set(Array.isArray(historyIds) ? historyIds : [])];
  if (!validId(eventId) || ids.length < 1 || ids.length > MAX_RECEIPTS || !ids.every(validId)) {
    throw new Error('invalid-payment-notification');
  }
  const caller = injectedCaller || httpsCallable(
    getFunctions(app, 'asia-northeast1'),
    'publishPaymentAddedNotifications',
    { timeout: timeoutMs },
  );
  const result = await caller({ eventId, historyIds: ids });
  return result?.data || result;
}
