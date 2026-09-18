// イベントを作らずに、フレンドと2人で割り勘を記録するときの計算。
//
// イベントを作るほどでもない場面（いつものメンバーで軽く出かけた、立て替えを1件だけ記録したい）
// のための、いちばん単純な形。2人ぶんだけを扱う。
//
// Firebase に触れないので、テストからそのまま読める。

export const SPLIT_MODES = Object.freeze({
  half: '半分ずつ',
  all: '全額を相手が負担',
  custom: '金額を指定',
});

const toInt = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.floor(value) : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return Number.isSafeInteger(n) ? n : null;
};

/**
 * 相手が負担する額を出す。
 * 端数は立て替えた人が多く持つ（1円の差で相手に多く請求しない）。
 */
export function debtorAmountOf({ total, mode = 'half', customAmount = 0 } = {}) {
  const sum = toInt(total);
  if (sum === null || sum <= 0) return { ok: false, reason: 'amount_invalid', amount: 0 };

  if (mode === 'all') return { ok: true, amount: sum };
  if (mode === 'custom') {
    const custom = toInt(customAmount);
    if (custom === null || custom <= 0) return { ok: false, reason: 'custom_invalid', amount: 0 };
    if (custom > sum) return { ok: false, reason: 'custom_over_total', amount: 0 };
    return { ok: true, amount: custom };
  }
  // 半分ずつ。割り切れないぶんは立て替えた人が持つ。
  return { ok: true, amount: Math.floor(sum / 2) };
}

/** 保存する取引の中身を組み立てる（Firestore へ書く直前の形） */
export function buildDirectTransaction({ total, mode, customAmount, itemName, myUid, friendUid, iPaid = true } = {}) {
  const share = debtorAmountOf({ total, mode, customAmount });
  if (!share.ok) return { ok: false, reason: share.reason };
  if (!myUid || !friendUid || myUid === friendUid) return { ok: false, reason: 'party_invalid' };
  const name = (typeof itemName === 'string' ? itemName : '').trim().slice(0, 60);
  if (!name) return { ok: false, reason: 'item_name_required' };

  // 立て替えた人が債権者、もう一方が債務者。
  const creditorUid = iPaid ? myUid : friendUid;
  const debtorUid = iPaid ? friendUid : myUid;
  return {
    ok: true,
    transaction: {
      paidById: debtorUid,   // 払う人
      paidToId: creditorUid, // 立て替えた人
      amount: share.amount,
      status: 'unpaid',
      approvalReviewRequired: false,
      itemName: name,
      eventName: '',         // イベントに属さない記録
    },
  };
}

export const SPLIT_ERRORS = Object.freeze({
  amount_invalid: '合計金額を、1円以上の数字で入れてください。',
  custom_invalid: '相手の負担額を、1円以上の数字で入れてください。',
  custom_over_total: '相手の負担額が、合計金額を超えています。',
  item_name_required: '何の支払いかを入れてください。',
  party_invalid: '相手を選び直してください。',
});
