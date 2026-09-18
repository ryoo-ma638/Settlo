// イベントからの退出を判断し、画面に出す文言を決める。
//
// 決まりごと
//  - リーダーのままでは退出できない。引き継ぐか、全員と精算してイベントを終了する。
//  - まとめて精算の最中は退出できない。途中で人数が変わると金額の計算が崩れるため。
//  - 未精算が残っていても退出できる。支払い画面には残り、新しい支払いは追加されない。
//    お金の記録は消さずに、イベントへの関わりだけをやめられるようにする。
//
// Firebase に触れないので、テストからそのまま読める。

const yen = (value) => `¥${(Number(value) || 0).toLocaleString()}`;

const participantIds = (event) => (Array.isArray(event?.participants) ? event.participants : [])
  .map((p) => (typeof p === 'string' ? p : p?.id))
  .filter(Boolean);

/**
 * 自分に関わる未精算を数える。
 * 払う分と受け取る分は意味が違うので、合算せず分けて返す。
 */
export function myOutstanding(histories = [], myUid = '') {
  const total = { payCount: 0, payAmount: 0, receiveCount: 0, receiveAmount: 0, count: 0 };
  if (!myUid) return total;
  for (const history of Array.isArray(histories) ? histories : []) {
    const shares = Array.isArray(history?.shares) ? history.shares : [];
    for (const share of shares) {
      if (!share || !share.isDebt || share.settled) continue;
      const amount = Number(share.amount) || 0;
      if (share.uid === myUid) {
        total.payCount += 1;
        total.payAmount += amount;
      } else if (history.payerUid && history.payerUid === myUid) {
        total.receiveCount += 1;
        total.receiveAmount += amount;
      }
    }
  }
  total.count = total.payCount + total.receiveCount;
  return total;
}

/** 退出できるか、できないなら理由は何かを返す */
export function eventExitState({ event = {}, myUid = '', outstanding } = {}) {
  const ids = participantIds(event);
  const left = outstanding || myOutstanding([], myUid);

  if (!myUid || !ids.includes(myUid)) {
    return { canLeave: false, blockedBy: 'not-member', message: 'このイベントの参加者ではありません。' };
  }
  if (event.leaderUid && event.leaderUid === myUid) {
    return {
      canLeave: false,
      blockedBy: 'leader',
      message: 'リーダーのまま退出はできません。別の参加者へリーダーを引き継ぐか、全員との精算後にイベントを終了してください。',
    };
  }
  if (event.activeEventSettlementPlanId) {
    return {
      canLeave: false,
      blockedBy: 'settling',
      message: 'まとめて精算の最中は退出できません。精算が終わってから退出してください。',
    };
  }
  if (left.count > 0) {
    const parts = [];
    if (left.payCount) parts.push(`支払う分${left.payCount}件（${yen(left.payAmount)}）`);
    if (left.receiveCount) parts.push(`受け取る分${left.receiveCount}件（${yen(left.receiveAmount)}）`);
    return {
      canLeave: true,
      blockedBy: null,
      message: `未精算の${parts.join('と')}は、退出後も支払い画面に残ります。退出後に新しい支払いを追加されることはありません。`,
    };
  }
  return {
    canLeave: true,
    blockedBy: null,
    message: '退出後は、新しい立て替えとグループ相談の対象から外れます。過去の記録は残ります。',
  };
}

// ========== 一覧から隠したイベント ==========
//
// 非表示は「退出」とは別のもの。参加者のままなので、いつでも戻せるようにする。
// ゴミ箱の控えは7日で自動整理されるが、`hiddenBy` はそのまま残るため、
// 控えが消えた後も戻せる場所がここに要る。

/** 自分の一覧から隠しているイベントか */
export const isHiddenFor = (event, myUid = '') => !!myUid
  && (Array.isArray(event?.hiddenBy) ? event.hiddenBy : []).includes(myUid);

/** 一覧に出すものと、隠しているものに分ける */
export function splitHiddenEvents(events = [], myUid = '') {
  const list = (Array.isArray(events) ? events : []).filter(Boolean);
  return {
    visible: list.filter((event) => !isHiddenFor(event, myUid)),
    hidden: list.filter((event) => isHiddenFor(event, myUid)),
  };
}

// ========== ホームに出す「進行中のイベント」 ==========

/**
 * 終了したイベントは「進行中」に出さない。並びは新しい順で、イベント一覧とそろえる。
 * 画面の中に書くと確かめられないので、ここへ出している。
 */
export function ongoingEventsOf(events = []) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => event && !event.ended)
    .sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
}
