const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- 1. 精算アルゴリズム (Greedy Matching) ---
function calculateMinimalTransfers(balances) {
  const creditors = [];
  const debtors = [];

  Object.keys(balances).forEach(user => {
    const amount = balances[user];
    if (amount > 0) creditors.push({ name: user, amount });
    else if (amount < 0) debtors.push({ name: user, amount: Math.abs(amount) });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const settlementAmount = Math.min(credit.amount, debt.amount);

    transfers.push({ from: debt.name, to: credit.name, amount: Math.round(settlementAmount) });

    credit.amount -= settlementAmount;
    debt.amount -= settlementAmount;
    if (credit.amount === 0) i++;
    if (debt.amount === 0) j++;
  }
  return transfers;
}

// --- 2. DBからデータを取得して計算するメイン関数 ---
async function main() {
  console.log("🚀 精算システム起動中...");

  // 最新のイベントを取得
  const event = await prisma.event.findFirst({
    orderBy: { id: 'desc' },
    include: { transactions: { include: { payer: true } } }
  });

  if (!event || event.transactions.length === 0) {
    console.log("❌ データが見つかりません。Prisma Studioでデータを保存しましたか？");
    return;
  }

  console.log(`\n📊 イベント名: ${event.name}`);

  // 全ユーザーを取得（5人を想定）
  const allUsers = await prisma.user.findMany();
  const participantCount = allUsers.length;
  
  // 総額の計算
  const totalAmount = event.transactions.reduce((sum, t) => sum + t.amount, 0);
  const averageShare = totalAmount / participantCount;

  // 各自の純残高を計算
  const balances = {};
  allUsers.forEach(u => balances[u.name] = 0); // 初期化
  event.transactions.forEach(t => {
    balances[t.payer.name] += t.amount;
  });
  allUsers.forEach(u => {
    balances[u.name] -= averageShare;
  });

  // アルゴリズム実行
  const result = calculateMinimalTransfers(balances);

  // --- 3. 結果の表示 ---
  console.log("-----------------------------------------");
  console.log(`💰 総額: ${totalAmount}円 (1人あたり: ${Math.round(averageShare)}円)`);
  console.log("-----------------------------------------");
  console.log("✅ 精算アクション（エントロピー減少のための操作）:");
  
  if (result.length === 0) {
    console.log("✨ 全員の貸し借りは既にゼロです。システムは基底状態にあります。");
  } else {
    result.forEach(t => {
      console.log(` 🌀 ${t.from} ➔ ${t.to} へ ${t.amount}円 送金せよ`);
    });
  }
  console.log("-----------------------------------------");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());