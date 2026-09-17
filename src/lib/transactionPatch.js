// 取引(transactions)の状態を書き換えるときの、決まった形をまとめたもの。
//
// なぜ分けているか
//   状態(status)と「送金状況の確認が必要か(approvalReviewRequired)」は必ず対で書き換える。
//   片方だけ書き換えると、差し戻しの印が消えないまま残り、その取引が
//   二度とまとめて精算に乗らなくなる（＝当事者が精算を終えられなくなる）。
//   そこで生の { status: ... } を書く場所をなくし、必ずこの4つのどれかを使う。
//
// このファイルは何も import しない。Firebase を起動せずにテストから読めるようにするため。

// 未払いへ戻す。まとめ精算の内訳（相殺の記録）は無効になるので必ず消す。
// 取り消しや、双方が合意した未精算戻しはこちら。確認の印は付けない。
export const UNPAID_PATCH = { status: 'unpaid', settlementBatch: null, approvalReviewRequired: false };

// 相手に差し戻された未払い。送金が済んでいるかは当事者にしか分からないので、
// 次のまとめて精算へ自動で混ぜず、送金状況を確かめてから進めてもらう。
export const REJECTED_PATCH = { ...UNPAID_PATCH, approvalReviewRequired: true };

// 精算完了。差し戻しの印は役目を終えるので必ず消す。
export const COMPLETED_PATCH = { status: 'completed', approvalReviewRequired: false };

// 相手の承認待ち。改めて手続きをやり直した時点で、差し戻しの印は消す。
export const AWAITING_PATCH = { status: 'awaiting_approval', approvalReviewRequired: false };
