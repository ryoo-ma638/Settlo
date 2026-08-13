// アバター表示の共通ロジック（頭文字1字＋名前から決まる背景色）
// 画面ごとにバラバラだった「無地の丸」をこの2つの関数で統一する。
// 色は名前だけから決めるので、同じ人はどの画面でも必ず同じ色になる。

// base.css に置いた --c-avatar-1〜8 を順に使う
const PALETTE_SIZE = 8;

// 名前から安定した数値を作る（同じ文字列なら常に同じ値）
const hashOf = (text) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) >>> 0;
  }
  return h;
};

// 表示する頭文字1字。英字は大文字に、名前が無いときは「?」。
export function avatarInitial(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  // サロゲートペア（絵文字など）も1字として正しく取り出す
  const first = Array.from(s)[0];
  return first.toUpperCase();
}

// 名前から決まる背景色（白文字が読める濃さの8色から選ぶ）
export function avatarColor(name) {
  const s = String(name || '').trim();
  if (!s) return 'var(--c-text-faint)';
  return `var(--c-avatar-${(hashOf(s) % PALETTE_SIZE) + 1})`;
}
