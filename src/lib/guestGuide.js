// 🌟 お試し（ゲスト）の案内が、どこまで進んだかを覚えている場所。
//
// 展示では、同じ端末を次の人へ渡すことがある。
// そのとき前の人の進み具合が残っていると、
//   ・案内が出ないまま渡ってしまう
//   ・前の人が動かしたあとのデータから始まってしまう
// ので、まとめて消せるようにしておく。

// はじめてガイド（3枚）を見たか
export const ONBOARDING_KEY = 'settlo_onboarding_done';
// 道案内のどの手順まで済んだか。
// ⚠️ 名前に版をつけている。「押したら済み」だった頃の記録を持ち越すと、
//    実際にやっていない手順に印が付いたままになるため。
export const TRAIL_KEY = 'settlo_guest_trail_v2';
const OLD_TRAIL_KEYS = ['settlo_guest_trail'];
// 道案内を閉じたか
export const TRAIL_HIDDEN_KEY = 'settlo_guest_trail_hidden';

// 案内だけを出し直す（データはそのまま）。閉じてしまった人がもう一度見るとき。
export const TRAIL_KEYS = [TRAIL_KEY, ...OLD_TRAIL_KEYS, TRAIL_HIDDEN_KEY];
// お試しを最初から。はじめてガイドも含めて全部。
export const ALL_GUIDE_KEYS = [ONBOARDING_KEY, ...TRAIL_KEYS];

// localStorage が使えない端末（プライベートモード等）でも落とさない。
// 消せた鍵を返す。
export function clearKeys(keys, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  const cleared = [];
  for (const key of keys || []) {
    try { store.removeItem(key); cleared.push(key); } catch (e) { /* 消せなくても続ける */ }
  }
  return cleared;
}

export const showTrailAgain = (storage) => clearKeys(TRAIL_KEYS, storage);
export const resetGuestGuide = (storage) => clearKeys(ALL_GUIDE_KEYS, storage);
