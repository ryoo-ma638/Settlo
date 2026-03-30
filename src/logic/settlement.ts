// src/logic/settlement.ts

interface UserBalance {
  userId: string;
  amount: number;
}

interface SettlementResult {
  from: string;
  to: string;
  amount: number;
}

/**
 * 誰が誰にいくら払えばよいか、最小送金回数で算出する
 */
export function getOptimizedSettlements(balances: UserBalance[]): SettlementResult[] {
  // 誤差を避けるため、一度コピーを作成し、0以外の残高のみ抽出
  let debtors = balances
    .filter((b) => b.amount < -0.01)
    .sort((a, b) => a.amount - b.amount); // 支払いが多い順（マイナスが大きい順）
  
  let creditors = balances
    .filter((b) => b.amount > 0.01)
    .sort((a, b) => b.amount - a.amount); // 受け取りが多い順

  const settlements: SettlementResult[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];

    // 送金額は「払うべき額」か「もらうべき額」の小さい方
    const settleAmount = Math.min(Math.abs(debtor.amount), creditor.amount);

    if (settleAmount > 0) {
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settleAmount), // 日本円なので四捨五入
      });
    }

    // 残高を更新
    debtor.amount += settleAmount;
    creditor.amount -= settleAmount;

    // 精算が終わった人をリストから除外
    if (Math.abs(debtor.amount) < 0.01) debtors.shift();
    if (Math.abs(creditor.amount) < 0.01) creditors.shift();
  }

  return settlements;
}

/**
 * 精算エントロピーを算出する（理系ロジック）
 * S = (送金ペア数) * ln(経過時間 + 1)
 */
export function calculateEntropy(settlementCount: number, createdAt: Date): number {
  const now = new Date();
  const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  // 送金が必要なペアが多いほど、時間が経つほどエントロピー増大
  return settlementCount * Math.log(diffHours + 1);
}