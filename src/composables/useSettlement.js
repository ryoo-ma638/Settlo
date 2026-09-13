// src/composables/useSettlement.js
import { computed, unref } from 'vue';
import { auth } from '../firebase';
import { buildSettlementSummary } from '../lib/settlementSummary';

// 割り勘の計算を行う専用の関数（ツール）
// myName は文字列でも ref でもOK（実データ取得後に反応できるよう unref で読む）
//
// 計算そのものは src/lib/settlementSummary.js に置いてある（Firestore・Vue に依存しない＝
// 単体で検証できる）。ここは画面のデータを渡して結果を返すだけの薄い入口。
export function useSettlement(eventData, myName) {

  const calculatedSummary = computed(() => buildSettlementSummary({
    participants: eventData.value.participants || [],
    history: eventData.value.history || [],
    myUid: auth.currentUser?.uid || null,
    myName: unref(myName) || '',
  }));

  // 計算結果を外に渡す
  return {
    calculatedSummary
  };
}
