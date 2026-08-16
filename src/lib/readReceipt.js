// 既読表示の共通ロジック（LINE風）
//   1対1   … 相手が読んだ「最後の1件」にだけ『既読』を出す（従来どおり）
//   グループ … その1件を読んだ人数を『既読 2人』で出す（自分以外の全員なら『全員既読』）
// 支払い1件＝グループチャットでは相手が1人に決まらないため、
// 1対1と同じ「相手が読んだか」の判定では既読がまったく出なかった。
// ここは Firebase に触らない純粋な関数だけを置く（画面から呼ぶだけ・単体で確認できる）。

// 自分以外の参加者のうち、そのメッセージを読んだ人数
export function readCountOf(message, myUid, participants = []) {
  const others = (participants || []).filter((u) => u && u !== myUid);
  const readBy = (message && message.readBy) || [];
  const readers = others.filter((u) => readBy.includes(u)).length;
  return { readers, others: others.length };
}

// グループの既読ラベル。まだ誰も読んでいなければ空文字（何も出さない）。
export function groupReadLabel(message, myUid, participants = []) {
  const { readers, others } = readCountOf(message, myUid, participants);
  if (others === 0 || readers === 0) return '';
  return readers >= others ? '全員既読' : `既読 ${readers}人`;
}

// 1対1で『既読』を出すメッセージのID（相手が読んだ自分の最後のメッセージ）
export function lastReadMessageId(messages = [], myUid, otherUid) {
  if (!myUid || !otherUid) return null;
  let id = null;
  for (const m of messages) {
    if (m && m.fromUid === myUid && (m.readBy || []).includes(otherUid)) id = m.id;
  }
  return id;
}
