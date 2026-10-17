// イベント詳細の表示状態。
// 参加していない（権限なし）・存在しない・読めない（通信の失敗）を、購読の結果からだけ決める。
// 「通信が遅い」だけでは状態を変えない。明示のエラーか、文書が無いと分かったときだけ変える。
export const EVENT_VIEW = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  DENIED: 'denied',
  MISSING: 'missing',
  ERROR: 'error',
});

// 購読のエラーから状態を決める。権限なしだけを「表示できない」に分け、それ以外は「読み込みに失敗」。
export function eventViewStateAfterError(code) {
  return code === 'permission-denied' ? EVENT_VIEW.DENIED : EVENT_VIEW.ERROR;
}

// 文書の有無から状態を決める。
// 通信が届いていない間、Firestoreは「キャッシュ由来で文書なし」の結果を返すことがある。
// それは「見つからない」ではなく「まだ読み込み中」として扱う（通信が遅いだけで止めない）。
export function eventViewStateAfterSnapshot(exists, fromCache = false) {
  if (exists) return EVENT_VIEW.READY;
  return fromCache ? EVENT_VIEW.LOADING : EVENT_VIEW.MISSING;
}

// 表示を止める状態か（止めるときは残っていたデータと購読を片付け、操作ボタンを出さない）。
export function isBlockedState(state) {
  return state === EVENT_VIEW.DENIED || state === EVENT_VIEW.MISSING || state === EVENT_VIEW.ERROR;
}

// 止めたときの案内。READY / LOADING では null。
export function eventViewMessage(state) {
  if (state === EVENT_VIEW.DENIED) {
    return { title: 'このイベントは表示できません', text: '参加しているメンバーだけが開けます。招待を受けてから、もう一度開いてください。', canRetry: false };
  }
  if (state === EVENT_VIEW.MISSING) {
    return { title: 'イベントが見つかりません', text: '削除されたか、リンクが古い可能性があります。', canRetry: false };
  }
  if (state === EVENT_VIEW.ERROR) {
    return { title: '読み込みに失敗しました', text: '通信状況を確認して、もう一度お試しください。', canRetry: true };
  }
  return null;
}
