import {
  collection,
  doc,
  getDocFromServer,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

const uniq = (values) => [...new Set((values || []).filter(Boolean))];
const participantIds = (value) => (value || [])
  .map((p) => (typeof p === 'string' ? p : p?.id || p?.uid))
  .filter(Boolean);

const isParty = (data, uid) => participantIds(data?.participants).includes(uid);
const requestIdFrom = (data) => data?.restoreRequestId || null;
const operationIdFrom = (data) => data?.restoreOperationId || null;

function sharedTrashRef(api, db, trashId) {
  return api.doc(db, 'trash', trashId);
}

export function createTrashRestoreStore(db, overrides = {}) {
  const api = {
    collection,
    doc,
    getDocFromServer,
    increment,
    runTransaction,
    serverTimestamp,
    ...overrides,
  };

  const newId = (collectionName) => api.doc(api.collection(db, collectionName)).id;

  // 2人が同じ通知を同時に確定すると、片方のcommit後にもう片方が
  // 「対象文書がもう無い」ためRulesで拒否されることがある。
  // 通知がサーバー上ですでに処理済みなら、失敗ではなく競合解決済みとして返す。
  async function decidedByOtherRequest(notificationId, error) {
    if (error?.code !== 'permission-denied' || !notificationId) throw error;
    try {
      const snap = await api.getDocFromServer(api.doc(db, 'notifications', notificationId));
      if (snap.exists() && snap.data().isRead === true) return { status: 'already-decided' };
    } catch (_confirmError) {
      // 確認できない場合は元の権限エラーを返す。未確認を成功扱いしない。
    }
    throw error;
  }

  async function restoreDeletedPayment({ trashId, actorUid, actorName, reason = '' }) {
    if (!trashId || !actorUid) return { status: 'invalid' };

    // Firestoreがtransactionを再実行しても、同じ参照へ書く。
    const operationId = `restore-${newId('notifications')}`;
    const historyId = newId('events');

    return api.runTransaction(db, async (tx) => {
      const trashRef = sharedTrashRef(api, db, trashId);
      const trashSnap = await tx.get(trashRef);
      if (!trashSnap.exists()) return { status: 'missing' };

      const trash = trashSnap.data();
      if (!isParty(trash, actorUid)) return { status: 'forbidden' };
      if (trash.status === 'restored') {
        return {
          status: 'already-restored',
          operationId: operationIdFrom(trash),
          historyId: trash.restoredHistoryId || null,
          transactionIds: trash.restoredTransactionIds || [],
          notificationIds: trash.restoreNotificationIds || [],
        };
      }
      if (trash.status !== 'trashed' || trash.type !== 'payment' || !trash.eventId) {
        return { status: 'stale' };
      }

      const eventRef = api.doc(db, 'events', trash.eventId);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists() || !participantIds(eventSnap.data().participants).includes(actorUid)) {
        return { status: 'forbidden' };
      }

      const snapshots = Array.isArray(trash.transactionSnapshots) ? trash.transactionSnapshots : [];
      if (snapshots.length === 0) return { status: 'invalid' };
      const txRefs = snapshots.map(() => api.doc(api.collection(db, 'transactions')));
      const historyRef = api.doc(db, 'events', trash.eventId, 'history', historyId);
      const recipients = participantIds(trash.participants).filter((uid) => uid !== actorUid);
      const notificationRefs = recipients.map(() => api.doc(api.collection(db, 'notifications')));

      // ここより上が全読取。以降は書込みだけにする。
      snapshots.forEach((snapshot, index) => {
        tx.set(txRefs[index], { ...snapshot, eventId: trash.eventId, createdAt: api.serverTimestamp() });
      });
      tx.set(historyRef, {
        ...(trash.historySnapshot || {}),
        transactionIds: txRefs.map((ref) => ref.id),
        status: 'unpaid',
        timestamp: api.serverTimestamp(),
      });
      tx.update(eventRef, { totalAmount: api.increment(Number(trash.amount) || 0) });
      tx.update(trashRef, {
        status: 'restored',
        restoredBy: actorUid,
        restoredHistoryId: historyRef.id,
        restoredTransactionIds: txRefs.map((ref) => ref.id),
        restoreNotificationIds: notificationRefs.map((ref) => ref.id),
        restoreOperationId: operationId,
        restoredAt: api.serverTimestamp(),
      });
      recipients.forEach((uid, index) => {
        tx.set(notificationRefs[index], {
          toUserId: uid,
          type: 'restore_check',
          trashId,
          restoreOperationId: operationId,
          eventId: trash.eventId,
          eventName: trash.eventName || '',
          itemName: trash.itemName || '支払い',
          amount: Number(trash.amount) || 0,
          fromUserId: actorUid,
          fromUserName: actorName || 'メンバー',
          userMessage: reason || null,
          isRead: false,
          createdAt: api.serverTimestamp(),
        });
      });

      return {
        status: 'restored',
        operationId,
        historyId: historyRef.id,
        transactionIds: txRefs.map((ref) => ref.id),
        notificationIds: notificationRefs.map((ref) => ref.id),
      };
    });
  }

  async function requestSettlementRestore({ trashId, actorUid, actorName, reason = '' }) {
    if (!trashId || !actorUid) return { status: 'invalid' };
    const restoreRequestId = `request-${newId('notifications')}`;

    return api.runTransaction(db, async (tx) => {
      const trashRef = sharedTrashRef(api, db, trashId);
      const trashSnap = await tx.get(trashRef);
      if (!trashSnap.exists()) return { status: 'missing' };
      const trash = trashSnap.data();
      if (!isParty(trash, actorUid)) return { status: 'forbidden' };
      if (trash.status === 'pending' && requestIdFrom(trash)) {
        return {
          status: 'already-pending',
          restoreRequestId: requestIdFrom(trash),
          notificationIds: trash.restoreRequestNotificationIds || [],
        };
      }
      if (trash.status !== 'trashed' || trash.type === 'payment') return { status: 'stale' };

      const recipients = uniq((trash.counterparties || []).map((c) => c?.uid))
        .filter((uid) => uid !== actorUid);
      if (recipients.length === 0) return { status: 'invalid' };
      const notificationRefs = recipients.map(() => api.doc(api.collection(db, 'notifications')));

      tx.update(trashRef, {
        status: 'pending',
        restoreRequestId,
        restoreRequestedBy: actorUid,
        restoreRequestedAt: api.serverTimestamp(),
        restoreRequestNotificationIds: notificationRefs.map((ref) => ref.id),
      });
      recipients.forEach((uid, index) => {
        tx.set(notificationRefs[index], {
          toUserId: uid,
          type: 'settlement_restore_request',
          trashId,
          restoreRequestId,
          eventId: trash.eventId || null,
          eventName: trash.eventName || '',
          historyId: trash.historyId || null,
          itemName: trash.itemName || '決済',
          amount: Number(trash.amount) || 0,
          transactionIds: trash.transactionIds || [],
          fromUserId: actorUid,
          fromUserName: actorName || 'メンバー',
          userMessage: reason || null,
          isRead: false,
          createdAt: api.serverTimestamp(),
        });
      });
      return {
        status: 'pending',
        restoreRequestId,
        notificationIds: notificationRefs.map((ref) => ref.id),
      };
    });
  }

  async function cancelSettlementRestore({ trashId, actorUid, restoreRequestId }) {
    if (!trashId || !actorUid || !restoreRequestId) return { status: 'invalid' };
    return api.runTransaction(db, async (tx) => {
      const trashRef = sharedTrashRef(api, db, trashId);
      const trashSnap = await tx.get(trashRef);
      if (!trashSnap.exists()) return { status: 'missing' };
      const trash = trashSnap.data();
      if (!isParty(trash, actorUid) || trash.restoreRequestedBy !== actorUid) return { status: 'forbidden' };
      if (trash.status !== 'pending' || requestIdFrom(trash) !== restoreRequestId) {
        return { status: 'stale-request' };
      }
      tx.update(trashRef, {
        status: 'trashed',
        restoreRequestId: null,
        restoreRequestedBy: null,
        restoreRequestNotificationIds: [],
        restoreCancelledRequestId: restoreRequestId,
        restoreCancelledAt: api.serverTimestamp(),
      });
      return { status: 'cancelled' };
    });
  }

  // NotificationIconから接続する契約。今回は同ファイルを編集しない。
  async function approveSettlementRestore({ notificationId, trashId, actorUid, restoreRequestId }) {
    if (!notificationId || !trashId || !actorUid || !restoreRequestId) return { status: 'invalid' };
    try {
      return await api.runTransaction(db, async (tx) => {
        const notificationRef = api.doc(db, 'notifications', notificationId);
        const trashRef = sharedTrashRef(api, db, trashId);
        const notificationSnap = await tx.get(notificationRef);
        const trashSnap = await tx.get(trashRef);
        if (!notificationSnap.exists() || !trashSnap.exists()) return { status: 'missing' };
        const notification = notificationSnap.data();
        const trash = trashSnap.data();
        if (notification.toUserId !== actorUid || !isParty(trash, actorUid)) return { status: 'forbidden' };
        if (notification.isRead || notification.restoreRequestId !== restoreRequestId
          || trash.status !== 'pending' || requestIdFrom(trash) !== restoreRequestId) {
          return { status: 'stale-request' };
        }

        const transactionIds = uniq(trash.transactionIds || notification.transactionIds);
        const refs = transactionIds.map((id) => api.doc(db, 'transactions', id));
        const snaps = [];
        for (const ref of refs) snaps.push(await tx.get(ref));
        if (snaps.some((snap) => !snap.exists())) return { status: 'stale-request' };
        if (snaps.some((snap) => {
          const value = snap.data();
          return (value.paidById !== actorUid && value.paidToId !== actorUid)
            || (value.status || 'unpaid') !== 'completed';
        })) return { status: 'stale-request' };

        refs.forEach((ref) => tx.update(ref, { status: 'unpaid', settlementBatch: null }));
        tx.delete(trashRef);
        tx.update(notificationRef, { isRead: true, decidedAt: api.serverTimestamp() });
        return { status: 'approved', transactionIds };
      });
    } catch (error) {
      return decidedByOtherRequest(notificationId, error);
    }
  }

  async function rejectRestoredPayment({ notificationId, trashId, actorUid, restoreOperationId }) {
    if (!notificationId || !trashId || !actorUid || !restoreOperationId) return { status: 'invalid' };
    try {
      return await api.runTransaction(db, async (tx) => {
        const notificationRef = api.doc(db, 'notifications', notificationId);
        const trashRef = sharedTrashRef(api, db, trashId);
        const notificationSnap = await tx.get(notificationRef);
        const trashSnap = await tx.get(trashRef);
        if (!notificationSnap.exists() || !trashSnap.exists()) return { status: 'already-decided' };
        const notification = notificationSnap.data();
        const trash = trashSnap.data();
        if (notification.toUserId !== actorUid || !isParty(trash, actorUid)) return { status: 'forbidden' };
        if (notification.isRead || notification.restoreOperationId !== restoreOperationId
          || trash.status !== 'restored' || operationIdFrom(trash) !== restoreOperationId) {
          return { status: 'already-decided' };
        }

        const eventRef = api.doc(db, 'events', trash.eventId);
        const historyRef = api.doc(db, 'events', trash.eventId, 'history', trash.restoredHistoryId);
        const restoredRefs = uniq(trash.restoredTransactionIds).map((id) => api.doc(db, 'transactions', id));
        const eventSnap = await tx.get(eventRef);
        const historySnap = await tx.get(historyRef);
        const restoredSnaps = [];
        for (const ref of restoredRefs) restoredSnaps.push(await tx.get(ref));
        if (!eventSnap.exists() || !historySnap.exists() || restoredSnaps.some((snap) => !snap.exists())) {
          return { status: 'inconsistent' };
        }

        restoredRefs.forEach((ref) => tx.delete(ref));
        tx.delete(historyRef);
        tx.update(eventRef, { totalAmount: api.increment(-(Number(trash.amount) || 0)) });
        tx.update(trashRef, {
          status: 'trashed',
          restoredHistoryId: null,
          restoredTransactionIds: [],
          restoredBy: null,
          restoreOperationId: null,
          restoreRejectedOperationId: restoreOperationId,
          restoreRejectedAt: api.serverTimestamp(),
        });
        tx.update(notificationRef, { isRead: true, decidedAt: api.serverTimestamp() });
        return { status: 'reverted' };
      });
    } catch (error) {
      return decidedByOtherRequest(notificationId, error);
    }
  }

  async function confirmRestoredPayment({ notificationId, trashId, actorUid, restoreOperationId }) {
    if (!notificationId || !trashId || !actorUid || !restoreOperationId) return { status: 'invalid' };
    try {
      return await api.runTransaction(db, async (tx) => {
        const notificationRef = api.doc(db, 'notifications', notificationId);
        const trashRef = sharedTrashRef(api, db, trashId);
        const notificationSnap = await tx.get(notificationRef);
        const trashSnap = await tx.get(trashRef);
        if (!notificationSnap.exists() || !trashSnap.exists()) return { status: 'already-decided' };
        const notification = notificationSnap.data();
        const trash = trashSnap.data();
        if (notification.toUserId !== actorUid || !isParty(trash, actorUid)) return { status: 'forbidden' };
        if (notification.isRead || notification.restoreOperationId !== restoreOperationId
          || trash.status !== 'restored' || operationIdFrom(trash) !== restoreOperationId) {
          return { status: 'already-decided' };
        }
        tx.delete(trashRef);
        tx.update(notificationRef, { isRead: true, decidedAt: api.serverTimestamp() });
        return { status: 'confirmed' };
      });
    } catch (error) {
      return decidedByOtherRequest(notificationId, error);
    }
  }

  return {
    restoreDeletedPayment,
    requestSettlementRestore,
    cancelSettlementRestore,
    approveSettlementRestore,
    rejectRestoredPayment,
    confirmRestoredPayment,
  };
}
