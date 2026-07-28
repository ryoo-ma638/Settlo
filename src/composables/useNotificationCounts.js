import { reactive, onUnmounted } from 'vue';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

// 未読の通知を「フレンド／支払い／イベント」に振り分けて件数を数える。
// 下ナビ（AppFooter）のバッジ用。多重カウントを避けるため、1タイプ＝1カテゴリに固定する。
// 判断が曖昧なタイプ（承認・チャット返信など）は最も自然な支払い/イベントに寄せる。

// イベント関連の通知タイプ（イベントから外された知らせもここ）
const EVENT_TYPES = new Set([
  'event_invite', 'event_edited', 'invite_rejected', 'event_joined',
  'event_restored', 'event_restore_rejected', 'event_left_check', 'event_left_rejected',
  'event_member_removed',
]);

// フレンド関連の通知タイプ。友達申請の件数（下記 qF）と同じフレンドバッジに足す。
const FRIEND_TYPES = new Set([
  'friend_removed',
]);

// 支払い関連の通知タイプ（承認依頼・未精算戻しなど）。
// チャット返信 thread_reply はチャットバッジ側で数えるので、支払いバッジには含めない（二重計上を避ける）。
const PAYMENT_TYPES = new Set([
  'approval_request', 'settlement_restore_request',
  'payment_reminder', 'approval_rejected', 'payment_completed', 'payment_edited',
  'payment_deleted', 'payment_delete_rejected', 'payment_reverted',
  'settlement_restore_approved', 'settlement_restore_rejected',
  'restore_check', 'restore_reverted',
]);
// 上記どちらにも入らないタイプ（profile_updated 等）は、どのフッターバッジにも数えない。
// （お知らせベルの合計には従来どおり含まれる）

export function useNotificationCounts() {
  const counts = reactive({ friend: 0, payment: 0, event: 0, total: 0 });
  let unsubNotif = null;
  let unsubFriend = null;
  let unsubAuth = null;

  // フレンドバッジ＝「未対応の友達申請」＋「フレンド関連の未読お知らせ」
  let friendReqCount = 0;
  let friendNotifCount = 0;

  const recalcTotal = () => {
    counts.friend = friendReqCount + friendNotifCount;
    counts.total = counts.friend + counts.payment + counts.event;
  };

  unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubNotif) { unsubNotif(); unsubNotif = null; }
    if (unsubFriend) { unsubFriend(); unsubFriend = null; }
    if (!user) {
      friendReqCount = friendNotifCount = 0;
      counts.friend = counts.payment = counts.event = counts.total = 0;
      return;
    }
    const uid = user.uid;

    // 未読の通知をカテゴリ別に集計（既存のベル購読と同じ条件・追加コストは小さい）
    const qN = query(
      collection(db, 'notifications'),
      where('toUserId', '==', uid),
      where('isRead', '==', false),
    );
    unsubNotif = onSnapshot(qN, (snap) => {
      let pay = 0;
      let ev = 0;
      let fr = 0;
      snap.docs.forEach((d) => {
        const t = d.data().type;
        if (EVENT_TYPES.has(t)) ev += 1;
        else if (PAYMENT_TYPES.has(t)) pay += 1;
        else if (FRIEND_TYPES.has(t)) fr += 1;
      });
      counts.payment = pay;
      counts.event = ev;
      friendNotifCount = fr;
      recalcTotal();
    }, () => {});

    // 友達申請（まだ対応していない pending だけ）の件数
    const qF = query(
      collection(db, 'friendRequests'),
      where('toId', '==', uid),
      where('status', '==', 'pending'),
    );
    unsubFriend = onSnapshot(qF, (snap) => {
      friendReqCount = snap.size;
      recalcTotal();
    }, () => {});
  });

  onUnmounted(() => {
    if (unsubNotif) unsubNotif();
    if (unsubFriend) unsubFriend();
    if (unsubAuth) unsubAuth();
  });

  return { counts };
}
