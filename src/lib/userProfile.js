// ログインした人の users/{uid} を用意するための、計算だけの部分。
// Firebase を読み込まないので、テストからそのまま呼べる。

// 新しく作るときの中身。
// photo と photoURL の両方を書くのは、画面によって読むキーが違うため
// （EditProfileView も同じ理由で両方に入れている）。
export function buildNewUserProfile(user) {
  return {
    uid: user.uid,
    name: user.displayName || '名前なし',
    email: user.email || '',
    photo: user.photoURL || '',
    photoURL: user.photoURL || '',
  };
}

// 作るべきかどうか。
// - まだ無い人だけ作る。すでにある人は触らない
//   （毎回書くと、あとから変えた名前がログインのたびに戻ってしまう）
// - 匿名のゲストは対象外。ゲストの分は setupGuestDemo が作る
export function shouldCreateUserProfile(user, exists) {
  if (!user || !user.uid) return false;
  if (user.isAnonymous) return false;
  return exists === false;
}
