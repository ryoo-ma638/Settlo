import { TRAIL_KEY } from './guestGuide.js';
import { markDone, normalizeDone } from './guestTrail.js';

// 🌟 お試しの案内で「実際にやった」ことを記録する。
//
//    見るだけの手順は押した時点で済みにしてよいが、
//    精算・AI・割り勘のように実際の操作がある手順は、
//    押しただけで済みが付くと「やった気」になってしまう。
//    本当に done になったところから、これを呼ぶ。
//
//    ⚠️ 合図を飛ばすだけでは届かない。
//       案内はホームにあるので、別の画面で操作しているあいだは外れていて、
//       誰も聞いていない。だから端末に書いてから合図も出す。
//       （案内は開き直したときに、書いてあるものを読む）
//
//    案内が出ていない人（ゲスト以外）が呼んでも問題ない。使われない記録が1つ残るだけ。
export const TRAIL_DONE_EVENT = 'settlo:trail-done';

// 「触ってみる」を始める合図。ButtonTour が受け取って、
// 実際のボタンを1つずつ光らせながら最後まで案内する。
// detail = { id, steps }
export const GUIDED_TASK_EVENT = 'settlo:start-guided-task';

// 案内が終わったあと、次の手順へ戻すための合図。
// ・開いたままの覆い（お知らせなど）を閉じる
// ・アシスタントを開き直して、次の1件を出す
export const CLOSE_OVERLAYS_EVENT = 'settlo:close-overlays';
export const OPEN_ASSISTANT_EVENT = 'settlo:open-assistant';
// 案内が動いている間だけ true。ヘッダーの「初めての方はここから」を引っ込める。
export const TOUR_STATE_EVENT = 'settlo:tour-state';

export function startGuidedTask(step) {
  if (!step || !Array.isArray(step.guide) || step.guide.length === 0) return false;
  try {
    window.dispatchEvent(new CustomEvent(GUIDED_TASK_EVENT, { detail: { id: step.id, steps: step.guide } }));
    return true;
  } catch (e) { return false; }
}

export function markTrailDone(id) {
  if (!id) return;
  try {
    const raw = localStorage.getItem(TRAIL_KEY);
    const current = normalizeDone(raw ? JSON.parse(raw) : []);
    if (current.includes(id)) return;
    localStorage.setItem(TRAIL_KEY, JSON.stringify(markDone(current, id)));
  } catch (e) { /* 保存できなくても本処理は止めない */ }
  // 案内が同じ画面に出ているときは、その場で印が付くようにする
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TRAIL_DONE_EVENT, { detail: { id } }));
    }
  } catch (e) { /* 合図が出せなくても本処理は止めない */ }
}
