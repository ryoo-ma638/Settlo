// 🌟 あとで開く画面を、手が空いているうちに裏で取っておく。
//
//    画面のうちいくつかは別ファイルに分けてあり、その画面へ移った瞬間に
//    取りに行く作りになっている。会場の電波だと、これが画面移動の待ちになる
//    （イベント詳細は135KBあり、いちばん重い）。
//
//    はじめてガイドを読んでいる数十秒のあいだに取っておけば、
//    実際に移動するときには手元にある状態にできる。
//
//    ⚠️ 最初の読み込みと取り合わないよう、画面が落ち着いてから1つずつ取る。

// 案内（初めての方へ）で通る順に並べてある
const ROUTES = [
  () => import('../views/EventDetails.vue'),          // 手順2・4・7で開く。いちばん大きい
  () => import('../views/CombinedSettlementView.vue'), // 手順3
  () => import('../views/CombinedActionView.vue'),     // 手順3の行き先
  () => import('../views/ChatListView.vue'),           // 手順5
  () => import('../views/ThreadView.vue'),             // 手順5
  () => import('../views/PaymentDetailView.vue'),      // 支払いの詳細
  () => import('../views/HelpView.vue'),               // ヘルプ・使い方
];

let started = false;

// 通信を節約する設定の人と、遅い回線の人には取りに行かない
function shouldSkip() {
  if (typeof navigator === 'undefined') return true;
  const c = navigator.connection;
  if (!c) return false;
  if (c.saveData) return true;
  return ['slow-2g', '2g'].includes(c.effectiveType);
}

const idle = (fn, timeout) => {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, Math.min(timeout, 1200));
};

export function prefetchRoutes() {
  if (started || shouldSkip()) return;
  started = true;
  let i = 0;
  const next = () => {
    if (i >= ROUTES.length) return;
    const load = ROUTES[i++];
    // 失敗しても何もしない。実際に開くときにもう一度取りに行くだけ
    Promise.resolve().then(load).catch(() => {}).then(() => idle(next, 3000));
  };
  // 最初の描画とデータの取得が落ち着くのを待ってから始める
  idle(next, 2500);
}
