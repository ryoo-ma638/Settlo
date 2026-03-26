import express from 'express';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

app.use(express.json());

// --- 1. 精算アルゴリズム (最小送金回数) ---
function calculateMinimalTransfers(balances) {
  const creditors = [];
  const debtors = [];
  
  Object.keys(balances).forEach(user => {
    const amount = balances[user];
    if (amount > 1) creditors.push({ name: user, amount }); // 誤差を考慮して1円以上
    else if (amount < -1) debtors.push({ name: user, amount: Math.abs(amount) });
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0, j = 0;
  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const settlementAmount = Math.min(credit.amount, debt.amount);
    
    transfers.push({ 
      from: debt.name, 
      to: credit.name, 
      amount: Math.round(settlementAmount) 
    });

    credit.amount -= settlementAmount;
    debt.amount -= settlementAmount;
    if (credit.amount <= 1) i++;
    if (debt.amount <= 1) j++;
  }
  return transfers;
}

// --- 2. エントロピー計算ロジック (理系モデル) ---
function calculateEntropy(balances, totalAmount, createdAt) {
  if (totalAmount === 0) return 0;

  const now = new Date();
  const t = (now - new Date(createdAt)) / (1000 * 60); // 経過時間(分)

  // 残高の偏り（乱雑さ）を算出
  const disorder = Object.values(balances).reduce((sum, b) => sum + Math.abs(b), 0);
  
  // S = (偏り / 総額) * ln(t + 2) * 係数
  // 時間が経つほど、かつ貸し借りの偏りが激しいほどエントロピーが増大する
  const entropyValue = (disorder / totalAmount) * Math.log(t + 2) * 10;
  return parseFloat(entropyValue.toFixed(3));
}

// --- 3. APIエンドポイント ---

// イベント（閉鎖系）の新規作成
app.post('/api/events', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "イベント名が必要です" });
    const newEvent = await prisma.event.create({
      data: { name, entropy: 0.0, isClosed: true }
    });
    console.log(`🌌 創世記: 新しい系「${name}」が誕生しました。`);
    res.json(newEvent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 支払い登録（活性化エネルギーを動的に計算）
app.post('/api/transactions', async (req, res) => {
  try {
    const { amount, description, payerId, eventId } = req.body;
    
    // 高額なほど活性化エネルギー（精算の心理的障壁）が高い
    const calculatedEa = Math.log10(parseInt(amount)) * 5;

    const newTransaction = await prisma.transaction.create({
      data: {
        amount: parseInt(amount),
        description,
        payerId: parseInt(payerId),
        eventId: parseInt(eventId),
        activationEnergy: calculatedEa
      }
    });

    // 支払いの追加自体でもエントロピーを少し上昇させる
    await prisma.event.update({
      where: { id: parseInt(eventId) },
      data: { entropy: { increment: 1.0 } }
    });

    res.json({ message: "エントロピー増大を観測。", activationEnergy: calculatedEa, data: newTransaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 特定イベントの精算状況（通知・警告機能付き）を取得 ---
app.get('/api/settlement/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { transactions: { include: { payer: true } } }
    });

    if (!event) return res.status(404).json({ error: "系が見つかりません" });

    const allUsers = await prisma.user.findMany();
    const totalAmount = event.transactions.reduce((sum, t) => sum + t.amount, 0);
    const averageShare = totalAmount / allUsers.length;

    const balances = {};
    allUsers.forEach(u => balances[u.name] = 0);
    event.transactions.forEach(t => { balances[t.payer.name] += t.amount; });
    allUsers.forEach(u => { balances[u.name] -= averageShare; });

    // エントロピー計算
    const dynamicEntropy = calculateEntropy(balances, totalAmount, event.createdAt) + event.entropy;
    const transfers = calculateMinimalTransfers(balances);

    // --- 通知・警告ロジック ---
    let alertMessage = null;
    let systemPriority = "NORMAL";

    if (dynamicEntropy > 100) {
      alertMessage = "⚠️ 警告: 熱的死を観測。これ以上の放置は系の完全な崩壊を招きます。直ちに精算を実行してください。";
      systemPriority = "EMERGENCY";
      console.log(`🚨 [ALERT] Event ID ${eventId}: Entropy limit exceeded!`);
    } else if (dynamicEntropy > 70) {
      alertMessage = "注意: 高エネルギー状態です。精算によるエントロピーの減少を推奨します。";
      systemPriority = "HIGH";
    }

    res.json({
      eventName: event.name,
      totalAmount,
      entropy: dynamicEntropy,
      transfers,
      alert: alertMessage,      // フロントエンドに表示させる警告文
      priority: systemPriority, // フロントエンドで色を変えるためのフラグ
      isHeatDeath: dynamicEntropy > 100
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 時の矢 & 異常検知アラート ---
cron.schedule('* * * * *', async () => {
  try {
    const events = await prisma.event.findMany({ where: { isClosed: true } });
    
    for (const event of events) {
      // エントロピーを増加
      const newEntropy = event.entropy + 0.1;
      await prisma.event.update({
        where: { id: event.id },
        data: { entropy: newEntropy }
      });

      // 限界突破チェック
      if (newEntropy > 100) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📢 [SYSTEM NOTIFICATION]`);
        console.log(`イベント「${event.name}」のエントロピーが100を突破しました。`);
        console.log(`精算という名の「仕事」を加えて、系を浄化してください。`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
    }
  } catch (error) {
    console.error("時間経過処理に失敗:", error);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Life-Entropy API Server running at http://localhost:${PORT}`);
});