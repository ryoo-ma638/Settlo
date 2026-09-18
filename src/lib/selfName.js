// 「あなた」「自分」のような一人称は、相手の画面に出てはいけない。
// 保存済みのデータにも混ざっているので、書くときと出すときの両方で弾く。
// ここは何も読み込まない（Firebase に触れない）ので、どこからでも使える。

// 相手の画面に出てはいけない一人称（過去に保存されたデータにも混ざっている）
export const SELF_WORDS = ['あなた', '自分', 'me', 'You', 'you'];

// 名前として使えない（空 or 一人称）かどうか
export function isSelfName(name) {
  if (!name) return true;
  return SELF_WORDS.includes(String(name).trim());
}

// 表示に使える名前だけ返す。使えなければ代わりの言葉。
export function displayName(name, fallback = '相手') {
  return isSelfName(name) ? fallback : String(name).trim();
}
