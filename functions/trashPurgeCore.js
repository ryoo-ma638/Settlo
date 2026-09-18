// 復元用の控えを自動で消すかどうかの判断。
// Firestore に触れないので、テストからそのまま呼べる。
//
// ⚠️ 以前は collectionGroup + where("trashedAt","<",cutoff) で絞っていたが、
//    これは COLLECTION_GROUP インデックスを要求し、それが無くて毎日落ちていた。
//    絞り込みはここで行い、インデックスを増やさない。

// 相手の確認を待っている状態。7日を過ぎても消さない。
const WAITING = ["pending", "restored"];

/**
 * @param {object} data 控えの中身（trashedAt / status）
 * @param {number} cutoffMs これより古いものが対象
 * @returns {"delete"|"keep-waiting"|"keep-young"|"keep-unknown"}
 */
function purgeDecision(data, cutoffMs) {
  const d = data || {};
  const trashedMs = d.trashedAt && typeof d.trashedAt.toMillis === "function"
    ? d.trashedAt.toMillis()
    : null;
  // 日付が読めないものは消さない（消してよいか判断できないため）
  if (trashedMs === null) return "keep-unknown";
  if (trashedMs >= cutoffMs) return "keep-young";
  if (WAITING.includes(d.status)) return "keep-waiting";
  return "delete";
}

module.exports = { purgeDecision, WAITING };
