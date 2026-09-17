const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { publishForRequest, paymentAddedPushBody, pushPolicy } = require('./paymentAddedNotificationsCore');

const publishPaymentAddedNotifications = onCall({ region: 'asia-northeast1' }, async request => {
  if (!request.auth || !request.auth.uid) throw new HttpsError('unauthenticated', 'ログインが必要です。');
  try {
    return await publishForRequest({
      db: admin.firestore(),
      timestamp: () => admin.firestore.FieldValue.serverTimestamp(),
      authUid: request.auth.uid,
      data: request.data,
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(error && error.code ? error.code : 'internal', error && error.message ? error.message : 'お知らせを作成できませんでした。');
  }
});

module.exports = { publishPaymentAddedNotifications, paymentAddedPushBody, pushPolicy };
