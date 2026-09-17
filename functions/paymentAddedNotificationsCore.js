const MAX_RECEIPTS = 5;

const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !value.includes('/');
const unique = values => [...new Set(values)];
const participantId = value => typeof value === 'string' ? value : value && value.id;
const appError = (code, message) => Object.assign(new Error(message), { code });

function paymentAddedPushBody(data) {
  const count = Number(data && data.count) || 0;
  return `支払いが${count}件追加されました。内容はアプリで確認してください。`;
}

function pushPolicy(data) {
  if (!data || data.suppressPush === true) return { send: false, body: '' };
  if (data.type === 'payment_batch_added') return { send: true, body: paymentAddedPushBody(data) };
  return { send: false, body: '' };
}

async function publishForRequest({ db, timestamp, authUid, data }) {
  const eventId = data && data.eventId;
  const historyIds = unique(Array.isArray(data && data.historyIds) ? data.historyIds : []);
  if (!validId(eventId) || historyIds.length < 1 || historyIds.length > MAX_RECEIPTS || !historyIds.every(validId)) {
    throw appError('invalid-argument', '登録済みの支払いを1〜5件指定してください。');
  }

  return db.runTransaction(async tx => {
    const eventRef = db.collection('events').doc(eventId);
    const userRef = db.collection('users').doc(authUid);
    const historyRefs = historyIds.map(id => eventRef.collection('history').doc(id));
    const [eventSnap, userSnap, ...historySnaps] = await Promise.all([
      tx.get(eventRef), tx.get(userRef), ...historyRefs.map(ref => tx.get(ref)),
    ]);
    if (!eventSnap.exists) throw appError('not-found', 'イベントが見つかりません。');
    const event = eventSnap.data() || {};
    const participantUids = unique((event.participants || []).map(participantId).filter(validId));
    if (!participantUids.includes(authUid)) throw appError('permission-denied', 'イベントの参加者ではありません。');

    const receipts = historySnaps.flatMap((snap, index) => {
      if (!snap.exists) return [];
      const history = snap.data() || {};
      const amount = Number(history.amount);
      if (!Number.isInteger(amount) || amount < 1) return [];
      const involved = unique([
        history.payerUid,
        ...(Array.isArray(history.shares)
          ? history.shares.filter(share => Number(share && share.amount) > 0).map(share => share && share.uid)
          : []),
      ].filter(uid => validId(uid) && participantUids.includes(uid)));
      // 古い履歴にpayerUid/sharesがない場合だけ、従来どおりイベント参加者を対象にする。
      const relatedUids = (involved.length ? involved : participantUids).filter(uid => uid !== authUid);
      return [{ historyId: historyIds[index], itemName: String(history.itemName || '支払い').slice(0, 60), amount, relatedUids }];
    });
    if (!receipts.length) throw appError('failed-precondition', '保存済みの支払いを確認できません。');

    const recipients = unique(receipts.flatMap(receipt => receipt.relatedUids));
    if (!recipients.length) return { receiptCount: receipts.length, recipientCount: 0, createdCount: 0 };
    const fromUserName = String((userSnap.exists && userSnap.data().name) || 'メンバー').slice(0, 60);
    const refsAndData = [];
    for (const uid of recipients) {
      const relatedReceipts = receipts.filter(receipt => receipt.relatedUids.includes(uid));
      for (const receipt of relatedReceipts) {
        refsAndData.push({
          ref: db.collection('notifications').doc(`payment-added.${receipt.historyId}.${uid}`),
          data: {
            type: 'payment_added', toUserId: uid, fromUserId: authUid, fromUserName,
            eventId, eventName: String(event.name || '').slice(0, 100), historyId: receipt.historyId,
            itemName: receipt.itemName, amount: receipt.amount, isRead: false,
            suppressPush: true, createdAt: timestamp(),
          },
        });
      }
      const operationId = relatedReceipts.map(item => item.historyId).sort().join('.');
      refsAndData.push({
        ref: db.collection('notifications').doc(`payment-batch-added.${operationId}.${uid}`),
        data: {
          type: 'payment_batch_added', toUserId: uid, fromUserId: authUid, fromUserName,
          eventId, eventName: String(event.name || '').slice(0, 100),
          historyIds: relatedReceipts.map(item => item.historyId), count: relatedReceipts.length,
          amount: relatedReceipts.reduce((sum, item) => sum + item.amount, 0),
          isRead: true, pushOnly: true, createdAt: timestamp(),
        },
      });
    }

    const existing = await Promise.all(refsAndData.map(item => tx.get(item.ref)));
    let createdCount = 0;
    existing.forEach((snap, index) => {
      if (snap.exists) return;
      tx.create(refsAndData[index].ref, refsAndData[index].data);
      createdCount += 1;
    });
    return { receiptCount: receipts.length, recipientCount: recipients.length, createdCount };
  });
}

module.exports = { publishForRequest, paymentAddedPushBody, pushPolicy };
