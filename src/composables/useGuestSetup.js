import { ref } from 'vue';

// ゲスト（デモ）で入場した直後だけ true になる「デモデータ準備中」の合図。
//
// 匿名ログインが通った時点で App.vue がホームへ移動させるため、
// サーバーがデモのイベント・精算を作り終える前にホームが描かれ、
// 「¥0」「進行中のイベントはありません」の空っぽの画面が数秒見えてしまう。
// 準備が終わるまでこのフラグを立てて、ホームの代わりに読込画面を出す。
const preparingGuestDemo = ref(false);

// 準備が長引いても操作できなくならないよう、この時間で自動的に通常表示へ戻す
const FALLBACK_MS = 10000;

let fallbackTimer = null;

const clearFallback = () => {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
};

// ゲスト入場の開始（デモデータの準備に入る）
const startGuestDemoSetup = () => {
  clearFallback();
  preparingGuestDemo.value = true;
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    preparingGuestDemo.value = false;
  }, FALLBACK_MS);
};

// 準備完了・失敗のどちらでも呼ぶ（通常表示に戻す）
const finishGuestDemoSetup = () => {
  clearFallback();
  preparingGuestDemo.value = false;
};

export function useGuestSetup() {
  return { preparingGuestDemo, startGuestDemoSetup, finishGuestDemoSetup };
}
