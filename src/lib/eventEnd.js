// イベントの終了を「人ごと」に扱うための計算。
//
// これまでは 1人が終了を押すと ended が true になり、**全員の画面が即座に終了済み**になった。
// 自分の知らないうちに締められるのは一方的なので、まず押した本人だけを終了にし、
// 他の人には「あなたも終了しますか？」を届ける。全員が終えたときに、イベント全体が終了になる。
//
// Firestore に触れないので、テストからそのまま呼べる。

// 参加者の形は画面によって違う。
//   イベント一覧 … ["uid", ...]（Firestore のまま）
//   イベント詳細 … [{ id, name, photo }, ...]（表示用に組み立て直したもの）
// どちらで渡されても同じ答えになるよう、UIDの配列にそろえる。
const uidsOf = (value) => (Array.isArray(value) ? value : [])
  .map((v) => (typeof v === 'string' ? v : (v && (v.id || v.uid)) || ''))
  .filter(Boolean);

const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/**
 * @param {object} event  イベント（participants / endedBy / ended）
 * @param {string} uid    見ている人
 */
export function eventEndState(event, uid) {
  const e = event || {};
  const participants = uidsOf(e.participants);
  const endedBy = list(e.endedBy);
  // 参加者でなくなった人の分は数えない（退出した人が残っていても止まらないように）
  const agreed = endedBy.filter((id) => participants.includes(id));
  const endedForAll = e.ended === true || (participants.length > 0 && agreed.length === participants.length);

  return {
    endedForAll,
    // 自分の画面で終了済みとして扱うか
    endedForMe: endedForAll || (!!uid && agreed.includes(uid)),
    agreedCount: agreed.length,
    total: participants.length,
    // まだ終了していない人
    waiting: participants.filter((id) => !agreed.includes(id)),
  };
}

/** 自分が終了を押したあとの endedBy と、全体が終了になるか */
export function endByMe(event, uid) {
  const e = event || {};
  const participants = uidsOf(e.participants);
  const endedBy = list(e.endedBy);
  const next = endedBy.includes(uid) ? endedBy : [...endedBy, uid];
  const agreed = next.filter((id) => participants.includes(id));
  return {
    endedBy: next,
    // 全員そろったときだけ、イベント全体を終了にする
    endsEvent: participants.length > 0 && agreed.length === participants.length,
    // 知らせる相手（自分以外で、まだ終了していない人）
    notify: participants.filter((id) => id !== uid && !agreed.includes(id)),
  };
}
