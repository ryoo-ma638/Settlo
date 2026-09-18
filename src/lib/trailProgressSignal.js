// 🌟 お試しの案内で「実際にやった」ことを伝える合図。
//
//    見るだけの手順は押した時点で済みにしてよいが、
//    精算・AI・割り勘のように実際の操作がある手順は、
//    押しただけで済みが付くと「やった気」になってしまう。
//    本当に done になったところから、この合図を出す。
//
//    案内が出ていない人（ゲスト以外）でも呼んで問題ない。誰も聞いていないだけ。
export const TRAIL_DONE_EVENT = 'settlo:trail-done';

export function markTrailDone(id) {
  if (!id || typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TRAIL_DONE_EVENT, { detail: { id } }));
  } catch (e) { /* 合図が出せなくても本処理は止めない */ }
}
